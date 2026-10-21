// Frontend/src/components/ui/command.jsx
//
// Adapted from the shadcn/ui "command" registry item.
//
//   Source:   https://ui.shadcn.com/r/styles/new-york/command.json
//   Upstream: ui/command.tsx
//   Licence:  MIT (c) shadcn
//   Fetched:  2026-10-21
//
// Changes from upstream, and why:
//   - TypeScript types removed (this project is JavaScript/JSX).
//   - The "use client" directive removed (a Vite SPA is client rendered).
//   - `lucide-react` replaced with `react-icons/bs`: Kanvora has exactly one
//     icon family and a second one would be a visual inconsistency.
//   - shadcn's colour utilities (bg-popover, text-muted-foreground, ...)
//     replaced with Kanvora's own `--kt-*` tokens, which resolve against the
//     active theme and the public light scope.
//   - `CommandDialog` omitted on purpose: the application already owns focus,
//     Escape and focus restoration through `hooks/useDialogFocus.js`. A Radix
//     dialog here would create a second focus owner for the same overlay.
//     `cmdk` still depends on Radix internally; that is a transitive package
//     fact, not a second dialog in this UI.
import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { BsSearch } from 'react-icons/bs'

import { cn } from '../../lib/utils'

const Command = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[var(--kt-surface)] text-[var(--kt-text)]',
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div
    className="flex items-center gap-2 border-b border-[var(--kt-border)] px-3"
    cmdk-input-wrapper=""
  >
    <BsSearch className="shrink-0 text-[var(--kt-muted)]" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-11 w-full bg-transparent py-3 text-sm text-[var(--kt-text)] outline-none placeholder:text-[var(--kt-muted)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-80 overflow-y-auto overflow-x-hidden p-2 app-scrollbar', className)}
    {...props}
  />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn('py-6 text-center text-sm text-[var(--kt-muted)]', className)}
    {...props}
  />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-[var(--kt-text)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--kt-muted)]',
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('mx-1 h-px bg-[var(--kt-border)]', className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-[var(--kt-accent-soft)] data-[selected=true]:text-[var(--kt-accent-text)] data-[disabled=true]:opacity-50',
      className
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({ className, ...props }) => (
  <span
    className={cn('ml-auto text-xs tracking-widest text-[var(--kt-muted)]', className)}
    {...props}
  />
)
CommandShortcut.displayName = 'CommandShortcut'

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator
}
