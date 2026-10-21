// BrandMark: the shared brand block for the public shell.
//
// One owner for the logo + wordmark so the header and the footer cannot drift
// apart again. The wordmark carries the name as real text; the logo image is
// decorative and therefore has an empty alt.
import { Link } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'

const sizes = {
  md: { image: 'h-10 w-10 rounded-xl shadow-sm', word: 'text-lg leading-tight' },
  lg: { image: 'h-11 w-11 rounded-xl', word: 'text-xl' }
}

function BrandMark({ size = 'md', className = '' }) {
  const tokens = sizes[size] || sizes.md

  return (
    <Link
      to="/"
      className={`flex items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 ${className}`.trim()}
    >
      <img className={tokens.image} src={kanvoraLogo} alt="" />
      <span className={`block font-bold text-[var(--kt-text)] ${tokens.word}`}>
        Kanvora
      </span>
    </Link>
  )
}

export default BrandMark
