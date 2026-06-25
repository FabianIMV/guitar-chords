import { useState } from 'react'

interface Props {
  initial?: string
  onSearch: (q: string) => void
  loading: boolean
}

export function SearchBar({ initial = '', onSearch, loading }: Props) {
  const [value, setValue] = useState(initial)

  return (
    <form
      className="searchbar"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(value)
        ;(document.activeElement as HTMLElement)?.blur()
      }}
    >
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="none"
        placeholder="Busca una canción o artista…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Buscar canción"
      />
      <button type="submit" disabled={loading} aria-label="Buscar">
        {loading ? '…' : '🔍'}
      </button>
    </form>
  )
}
