import type { DayRecord, PresetKey, Settings, TaskKey } from '@nekase/core';
import { ax } from '@nekase/core';

import type { RecordRow, SettingsRow } from '../storage/types';

/** 保存用の行(storage)を、core の計算用の型にする。 */
export function toDayRecord(row: RecordRow | null | undefined): DayRecord | null {
  if (!row) return null;
  return { bed: row.bed_min, wake: row.wake_min, screen: row.screen === 1, caffeine: row.caffeine === 1 };
}

export function toSettings(row: SettingsRow): Settings {
  return {
    targetBed: ax(row.target_bed),
    targetWake: ax(row.target_wake),
    tasks: JSON.parse(row.tasks_json) as TaskKey[],
    preset: row.preset as PresetKey,
  };
}
