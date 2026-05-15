package main

import (
	"context"
	"database/sql"
	"fmt"
)

func upsertPlaidItem(ctx context.Context, db *sql.DB, supabaseUserID, plaidItemID, plaidAccessToken string) error {
	const q = `
		INSERT INTO plaid_items (supabase_user_id, plaid_item_id, plaid_access_token)
		VALUES ($1::uuid, $2, $3)
		ON CONFLICT (supabase_user_id, plaid_item_id)
		DO UPDATE SET
			plaid_access_token = EXCLUDED.plaid_access_token
	`
	if _, err := db.ExecContext(ctx, q, supabaseUserID, plaidItemID, plaidAccessToken); err != nil {
		return fmt.Errorf("upsert plaid_items: %w", err)
	}
	return nil
}
