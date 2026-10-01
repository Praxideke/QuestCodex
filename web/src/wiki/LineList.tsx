import type { ReactNode } from 'react'
import { cls } from '../cls'
import type { FormattedLine } from './format'

/** 진행현황이 얹는 표시. 위키는 FormattedLine 만 넘기므로 셋 다 없다. */
export interface ListLine extends FormattedLine {
  /** 오른쪽 끝 작은 글씨 — 목표 카운터 "7/15", 미충족 조건의 "지금 47" */
  aside?: ReactNode
  /** done: 끝난 목표(취소선), unmet: 아직 못 채운 시작 조건 */
  state?: 'done' | 'unmet'
}

interface LineListProps {
  lines: ListLine[]
  /** 비어 있을 때 한 줄 문구 ("목표 정보 없음" 등). 빈 문자열이면 아무것도 안 그린다. */
  empty: string
  onJump(questId: string): void
}

/** FormattedLine[] → 불릿 목록. questId 가 있는 조각은 연계 점프 버튼. */
export function LineList({ lines, empty, onJump }: LineListProps) {
  if (lines.length === 0) return empty ? <p className="qc-detail__note">{empty}</p> : null
  return (
    <ul className="qc-lines">
      {lines.map((line, i) => (
        <li
          key={i}
          className={cls(
            line.tone === 'muted' && 'qc-muted', line.tone === 'warn' && 'qc-warn',
            line.state === 'done' && 'is-done', line.state === 'unmet' && 'is-unmet',
          )}
        >
          <span className="qc-lines__text">
            {line.parts.map((p, j) => {
              const id = p.questId
              return id
                ? <button key={j} type="button" className="qc-link" onClick={() => onJump(id)}>{p.text}</button>
                : <span key={j}>{p.text}</span>
            })}
          </span>
          {line.aside && <span className="qc-lines__aside">{line.aside}</span>}
        </li>
      ))}
    </ul>
  )
}
