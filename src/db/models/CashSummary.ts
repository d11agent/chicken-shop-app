import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

/**
 * 4.6 Daily summary — recomputable aggregate cache keyed by IST day ('YYYY-MM-DD').
 * The ledgers remain the source of truth; this row can always be rebuilt from them.
 * net_profit = (cash + online + udhar_collected) - raw_material - wastage - bad_debt.
 */
export default class CashSummary extends Model {
  static table = 'cash_summary';

  @field('date_key') dateKey!: string; // IST 'YYYY-MM-DD'
  @field('cash_total') cashTotal!: number; // paise
  @field('online_total') onlineTotal!: number;
  @field('udhar_given') udharGiven!: number;
  @field('udhar_collected') udharCollected!: number;
  @field('raw_material_total') rawMaterialTotal!: number;
  @field('wastage_total') wastageTotal!: number;
  @field('bad_debt_total') badDebtTotal!: number;
  @field('net_profit') netProfit!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
