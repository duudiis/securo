import type { Account, Transaction } from '@/types'

/**
 * Placeholder rows for skeleton mask mode (see components/skeleton-surface):
 * while a page loads it feeds these through its REAL row components, and the
 * [data-skeletonize] mask turns the rendered leaves into shimmer bars — so
 * the skeleton has exactly the page's true layout. Text values only need
 * representative WIDTHS; they are never visible.
 */

const DESCRIPTIONS = [
  'Grocery market downtown',
  'Monthly subscription',
  'Restaurant',
  'Transfer received from employer',
  'Utility bill payment',
  'Online purchase',
  'Coffee shop',
  'Pharmacy and household items',
]

const PH_COLOR = '#8A8F9E'

export function placeholderTransactions(n = 10): Transaction[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ph-tx-${i}`,
    user_id: 'ph',
    account_id: 'ph-acc',
    description: DESCRIPTIONS[i % DESCRIPTIONS.length],
    amount: i % 3 === 0 ? '1234.56' : '87.90',
    amount_primary: null,
    currency: 'USD',
    date: '2026-01-15',
    type: i % 4 === 0 ? 'credit' : 'debit',
    category: {
      id: `ph-cat-${i % 3}`,
      name: ['Groceries', 'Transport', 'Subscriptions'][i % 3],
      icon: 'circle-help',
      color: PH_COLOR,
      group_id: null,
    },
    category_id: `ph-cat-${i % 3}`,
    notes: null,
    tags: [],
    attachment_count: 0,
    is_shared: false,
    group_id: null,
    transfer_pair_id: null,
    recurring_transaction_id: null,
    is_ignored: false,
    source: 'manual',
    payee_id: null,
    external_id: null,
  })) as unknown as Transaction[]
}

export function placeholderAccounts(n = 4): Account[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ph-acc-${i}`,
    user_id: 'ph',
    connection_id: null,
    external_id: null,
    name: ['Checking account', 'Savings', 'Credit card', 'Wallet'][i % 4],
    display_name: null,
    masked_number: null,
    type: ['checking', 'savings', 'credit_card', 'wallet'][i % 4],
    currency: 'USD',
    current_balance: i % 2 === 0 ? 12345.67 : 890.12,
    previous_balance: null,
    balance_primary: null,
    credit_limit: null,
    available_credit: null,
    statement_close_day: null,
    payment_due_day: null,
    next_due_date: null,
    is_closed: false,
    institution_name: null,
    institution_logo_url: null,
  })) as unknown as Account[]
}
