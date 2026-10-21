// Frontend/src/lib/utils.js
//
// A small class-name helper for the copied UI primitives. `clsx` flattens
// conditional class arguments and `tailwind-merge` lets a later Tailwind
// utility win over an earlier conflicting one. Both are MIT.
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
