import { useQuery } from '@powersync/react';
import { ChevronRight, Package, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Screen, SectionLabel } from '../components/ui';

interface Counts {
  lost_open: number;
  equip_open: number;
}

export function RecordsHub() {
  const navigate = useNavigate();
  const { data } = useQuery<Counts>(
    `SELECT
       (SELECT count(*) FROM lost_item WHERE status NOT IN ('returned', 'disposed')) AS lost_open,
       (SELECT count(*) FROM equipment_issue WHERE status != 'resolved') AS equip_open`,
  );
  const counts = data[0];

  const sections = [
    {
      to: '/records/lost',
      icon: Package,
      title: '忘れ物',
      hint: '写真付きで起票し、保管→連絡→返却まで追う台帳。',
      open: counts?.lost_open ?? 0,
    },
    {
      to: '/records/equipment',
      icon: Wrench,
      title: '設備・備品',
      hint: '不具合と補充・発注を写真付きで起票し、対応状況を追う。',
      open: counts?.equip_open ?? 0,
    },
  ];

  return (
    <Screen>
      <SectionLabel>台帳</SectionLabel>
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.to}
              type="button"
              onClick={() => navigate(section.to)}
              className="mb-3 flex w-full items-center gap-3.5 rounded-kb border border-line bg-paper p-4 text-left shadow-kb-sm"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-green/10 text-green">
                <Icon size={22} />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-[1rem]">{section.title}</span>
                  {section.open > 0 ? <Badge tone="warn">対応中 {section.open}</Badge> : null}
                </span>
                <span className="mt-0.5 block text-[0.78rem] text-ink-light">{section.hint}</span>
              </span>
              <ChevronRight size={16} className="text-ink-mute" />
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
