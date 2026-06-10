import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Languages,
  Map as MapIcon,
  MapPin,
  Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface KindMeta {
  label: string;
  icon: LucideIcon;
  hint?: string;
}

export const KIND_META: Record<string, KindMeta> = {
  manual: { label: 'マニュアル', icon: BookOpen },
  procedure: { label: '手順', icon: ClipboardList },
  location: {
    label: '物の置き場所',
    icon: MapPin,
    hint: '場所と写真を入れて「探して止まる」を解消する面。気づいた人が追記します。',
  },
  area: { label: '周辺案内', icon: MapIcon },
  emergency: { label: '緊急・防災', icon: AlertTriangle },
  price: { label: '価格', icon: Tag },
  phrase: {
    label: 'フレーズ',
    icon: Languages,
    hint: 'スピーカーで発音を再生できます。',
  },
};

export const KIND_ORDER = [
  'manual',
  'procedure',
  'location',
  'area',
  'emergency',
  'price',
  'phrase',
] as const;
