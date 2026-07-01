import type { UnitType } from '../../db/constants';
import type { SplitInput } from './calc';

export type { SplitInput } from './calc';

/** A line the shopkeeper adds to a draft bill. */
export interface DraftLineInput {
  menuItemId?: string; // null for an ad-hoc item
  itemName: string; // snapshotted onto the line
  mode: UnitType;
  quantity?: number; // qty mode (float)
  unitPrice?: number; // qty mode: paise/unit, frozen at add time
  amount?: number; // amount mode: paise
}

/** Inputs required to confirm (lock) a draft bill. */
export interface ConfirmBillInput {
  splits: SplitInput[];
  note?: string;
}
