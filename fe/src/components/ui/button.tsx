import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-[#1E3A5F] text-white hover:bg-[#274c78]',
      secondary: 'border border-[#CBD5E1] bg-white text-[#1E3A5F] hover:bg-[#F8FAFC]',
      ghost: 'text-[#1E3A5F] hover:bg-[#F1F5F9]',
      danger: 'bg-[#B42318] text-white hover:bg-[#912018]',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-9 px-3', lg: 'h-11 px-5', icon: 'h-10 w-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
