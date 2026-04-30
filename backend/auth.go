package main

import (
	"context"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	ctxSupabaseUserID = "supabaseUserID"
	ctxSupabaseEmail  = "supabaseEmail"
)

type supabaseAccessClaims struct {
	jwt.RegisteredClaims
	Email string `json:"email,omitempty"`
}

func supabaseJWKSURL(base string) string {
	return strings.TrimRight(base, "/") + "/auth/v1/.well-known/jwks.json"
}

func supabaseExpectedIssuer(base string) string {
	return strings.TrimRight(base, "/") + "/auth/v1"
}

func newSupabaseKeyfunc(ctx context.Context, supabaseURL string) (keyfunc.Keyfunc, error) {
	return keyfunc.NewDefaultCtx(ctx, []string{supabaseJWKSURL(supabaseURL)})
}

func supabaseAuthMiddleware(k keyfunc.Keyfunc, expectedIssuer string) gin.HandlerFunc {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithIssuer(expectedIssuer),
		jwt.WithAudience("authenticated"),
	)
	return func(c *gin.Context) {
		authz := strings.TrimSpace(c.GetHeader("Authorization"))
		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		raw := strings.TrimSpace(parts[1])

		var claims supabaseAccessClaims
		if _, err := parser.ParseWithClaims(raw, &claims, k.Keyfunc); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		if claims.Subject == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing subject"})
			return
		}

		c.Set(ctxSupabaseUserID, claims.Subject)
		if claims.Email != "" {
			c.Set(ctxSupabaseEmail, claims.Email)
		}
		c.Next()
	}
}

func handleMe(c *gin.Context) {
	uid, ok := c.Get(ctxSupabaseUserID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	out := gin.H{"user_id": uid.(string)}
	if email, ok := c.Get(ctxSupabaseEmail); ok {
		out["email"] = email.(string)
	}
	c.JSON(http.StatusOK, out)
}
