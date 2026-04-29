package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	plaid "github.com/plaid/plaid-go/v42/plaid"
)

var (
	PLAID_CLIENT_ID                       = ""
	PLAID_SECRET                          = ""
	PLAID_ENV                             = ""
	PLAID_PRODUCTS                        = ""
	PLAID_COUNTRY_CODES                   = ""
	PLAID_REDIRECT_URI                    = ""
	SIGNAL_RULESET_KEY                    = ""
	APP_PORT                              = ""
	CORS_ALLOWED_ORIGINS                  = ""
	client               *plaid.APIClient = nil

	accessToken = ""
	itemID      = ""
)

var environments = map[string]plaid.Environment{
	"sandbox":    plaid.Sandbox,
	"production": plaid.Production,
}

// Helper for production list of CORS ALLOWED ORIGINS
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func init() {
	// Load env vars from .env file
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error when loading environment variables from .env file %w", err)
	}

	// Set constants from env
	PLAID_CLIENT_ID = os.Getenv("PLAID_CLIENT_ID")
	PLAID_SECRET = os.Getenv("PLAID_SECRET")

	if PLAID_CLIENT_ID == "" || PLAID_SECRET == "" {
		log.Fatal("Error: PLAID_SECRET or PLAID_CLIENT_ID is not set.")
	}

	PLAID_ENV = os.Getenv("PLAID_ENV")
	PLAID_PRODUCTS = os.Getenv("PLAID_PRODUCTS")
	PLAID_COUNTRY_CODES = os.Getenv("PLAID_COUNTRY_CODES")
	PLAID_REDIRECT_URI = os.Getenv("PLAID_REDIRECT_URI")
	SIGNAL_RULESET_KEY = os.Getenv("SIGNAL_RULESET_KEY")
	APP_PORT = os.Getenv("APP_PORT")
	CORS_ALLOWED_ORIGINS = os.Getenv("CORS_ALLOWED_ORIGINS")

	// set defaults
	if PLAID_PRODUCTS == "" {
		PLAID_PRODUCTS = "transactions"
	}
	if PLAID_COUNTRY_CODES == "" {
		PLAID_COUNTRY_CODES = "US"
	}
	if PLAID_ENV == "" {
		PLAID_ENV = "sandbox"
	}
	if APP_PORT == "" {
		APP_PORT = "8000"
	}
	if CORS_ALLOWED_ORIGINS == "" {
		CORS_ALLOWED_ORIGINS = "http://localhost:5173"
	}
	if PLAID_CLIENT_ID == "" {
		log.Fatal("PLAID_CLIENT_ID is not set")
	}
	if PLAID_SECRET == "" {
		log.Fatal("PLAID_SECRET is not set.")
	}

	// create Plaid Client
	configuration := plaid.NewConfiguration()
	configuration.AddDefaultHeader("PLAID-CLIENT-ID", PLAID_CLIENT_ID)
	configuration.AddDefaultHeader("PLAID-SECRET", PLAID_SECRET)
	configuration.UseEnvironment(environments[PLAID_ENV])
	client = plaid.NewAPIClient(configuration)
}

func main() {
	r := gin.Default()
	allowedOrigins := splitCSV(CORS_ALLOWED_ORIGINS)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.POST("/api/info", info)

	/* Account Connection Flow
	1. call create_link_token and pass to client
	2. Use link_token to open Link for user and get temp public_token onSuccess
	3. Call get_access_token to exchange public_token for access_token
	4. Store access_token and use it to make product requests

	*/
	r.POST("/api/create_link_token", createLinkToken)
	r.POST("/api/get_access_token", GetAccessToken)
	r.POST("/api/link_exit_error", linkExitError) // Diagnostics for Early Link Exit

	err := r.Run(":" + APP_PORT)
	if err != nil {
		panic("unable to start server")
	}

}

func info(context *gin.Context) {
	context.JSON(http.StatusOK, map[string]interface{}{
		"item_id":      itemID,
		"access_token": accessToken,
		"products":     strings.Split(PLAID_PRODUCTS, ","),
	})
}

func createLinkToken(c *gin.Context) {
	ctx := context.Background()

	// Unique ID for current user.
	user := plaid.LinkTokenCreateRequestUser{
		ClientUserId: time.Now().String(),
	}

	// Create a link_token for the given user
	request := plaid.NewLinkTokenCreateRequest(
		"GYMUNYFU",
		"en",
		[]plaid.CountryCode{plaid.COUNTRYCODE_US},
	)
	request.SetUser(user)
	request.SetProducts([]plaid.Products{
		plaid.PRODUCTS_TRANSACTIONS,
		plaid.PRODUCTS_AUTH,
	})
	if PLAID_REDIRECT_URI != "" {
		request.SetRedirectUri(PLAID_REDIRECT_URI)
	}

	linkTokenCreateResp, _, err := client.PlaidApi.LinkTokenCreate(ctx).LinkTokenCreateRequest(*request).Execute()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"link_token": linkTokenCreateResp.GetLinkToken(),
	})
}

func GetAccessToken(c *gin.Context) {
	ctx := context.Background()
	publicToken := c.PostForm("public_token")

	// exchange public_token for an access_token
	exchangePublicTokenReq := plaid.NewItemPublicTokenExchangeRequest(publicToken)
	exchangePublicTokenResp, _, err := client.PlaidApi.ItemPublicTokenExchange(ctx).ItemPublicTokenExchangeRequest(
		*exchangePublicTokenReq,
	).Execute()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Values should be saved to a persistent DB and associated with current user
	accessToken = exchangePublicTokenResp.GetAccessToken()
	itemID = exchangePublicTokenResp.GetItemId()

	c.JSON(http.StatusOK, gin.H{
		"public_token_exchange": "complete",
	})
}

func linkExitError(c *gin.Context) {
	var body map[string]interface{}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	jsonBytes, _ := json.MarshalIndent(body, "", "  ")
	fmt.Println("[Link Exit Error (frontend)]")
	fmt.Println(string(jsonBytes))
	c.JSON(http.StatusOK, gin.H{"status": "logged"})
}
