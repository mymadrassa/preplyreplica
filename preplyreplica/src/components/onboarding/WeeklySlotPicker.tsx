import clsx from 'clsx'
import { WEEKDAYS } from '@/lib/constants'
import type { WeeklySlot } from './WizardProvider'

// Deliberately coarse (weekday x time-of-day band) rather than a full custom
// time-range picker -- this only feeds the recommendation scorer's
// availability-overlap heuristic, not a real bookable calendar.
export const TIME_BANDS = [
  { key: 'morning', label: 'Morning', start_time: '08:00', end_time: '12:00' },
  { key: 'afternoon', label: 'Afternoon', start_time: '12:00', end_time: '17:00' },
  { key: 'evening', label: 'Evening', start_time: '17:00', end_time: '21:00' },
] as const

function slotKey(slot: WeeklySlot) {
  return `${slot.weekday}-${slot.start_time}-${slot.end_time}`
}

export function WeeklySlotPicker({ value, onChange }: { value: WeeklySlot[]; onChange: (slots: WeeklySlot[]) => void }) {
  const selectedKeys = new Set(value.map(slotKey))

  function toggle(weekday: number, band: (typeof TIME_BANDS)[number]) {
    const slot: WeeklySlot = { weekday, start_time: band.start_time, end_time: band.end_time }
    const key = slotKey(slot)
    if (selectedKeys.has(key)) {
      onChange(value.filter((s) => slotKey(s) !== key))
    } else {
      onChange([...value, slot])
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            <th className="text-left text-sm font-medium text-slate-500"></th>
            {TIME_BANDS.map((band) => (
              <th key={band.key} className="text-sm font-medium text-slate-500">
                {band.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((day) => (
            <tr key={day.value}>
              <td className="whitespace-nowrap pr-2 text-sm font-medium text-slate-700">{day.label}</td>
              {TIME_BANDS.map((band) => {
                const selected = selectedKeys.has(slotKey({ weekday: Number(day.value), start_time: band.start_time, end_time: band.end_time }))
                return (
                  <td key={band.key}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${day.label} ${band.label}`}
                      onClick={() => toggle(Number(day.value), band)}
                      className={clsx(
                        'h-10 w-full rounded-xl border transition-colors',
                        selected ? 'border-brand-600 bg-brand-600' : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
