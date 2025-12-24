import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type AccountRow = Tables<'accounts'>;

const ADJUSTMENT_CODE = '9999';
const ADJUSTMENT_NAME = 'Ajustements';

export async function computeAccountCurrentBalance(accountId: string) {
  // balance = debit - credit
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit,credit')
    .eq('account_id', accountId);

  let debit = 0;
  let credit = 0;
  for (const l of lines || []) {
    debit += Number(l.debit || 0);
    credit += Number(l.credit || 0);
  }
  return debit - credit;
}

export async function ensureAdjustmentAccount(userId: string) {
  // Try to find an existing adjustment account for this user
  const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('code', ADJUSTMENT_CODE)
    .limit(1)
    .maybeSingle();

  if (data && data.id) return data.id;

  // Create one
  const { data: inserted, error } = await supabase
    .from('accounts')
    .insert({ code: ADJUSTMENT_CODE, name: ADJUSTMENT_NAME, type: 'passif', user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return (inserted as AccountRow).id;
}

export async function createBalanceAdjustmentEntry({
  userId,
  accountId,
  delta,
  counterpartAccountId,
  date = new Date().toISOString().slice(0, 10),
  reference = 'Ajustement solde via édition compte',
}: {
  userId: string;
  accountId: string;
  delta: number; // desired - current
  counterpartAccountId: string;
  date?: string;
  reference?: string;
}) {
  const amount = Math.round(Math.abs(delta) * 100) / 100;
  if (amount <= 0) return;

  // Determine debit/credit for target account: balance = debit - credit
  // To increase balance (delta > 0) => add debit on target account
  const targetDebit = delta > 0 ? amount : 0;
  const targetCredit = delta < 0 ? amount : 0;

  const counterpartDebit = delta < 0 ? amount : 0;
  const counterpartCredit = delta > 0 ? amount : 0;

  // Create journal entry
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, entry_date: date, reference, description: reference, created_by_user_id: userId })
    .select()
    .single();

  if (entryError) throw entryError;

  const lines = [
    { entry_id: entry.id, account_id: accountId, debit: targetDebit, credit: targetCredit },
    { entry_id: entry.id, account_id: counterpartAccountId, debit: counterpartDebit, credit: counterpartCredit },
  ];

  const { error: linesError } = await supabase.from('journal_lines').insert(lines);
  if (linesError) throw linesError;
}

export default {
  computeAccountCurrentBalance,
  ensureAdjustmentAccount,
  createBalanceAdjustmentEntry,
};
