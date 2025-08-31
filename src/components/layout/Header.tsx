'use client'

import React from 'react'
import Link from 'next/link'

const Header = () => {
  return (
    <header className="bg-gray-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        {/* Logo / Site Name */}
        <Link href="/" className="text-xl font-bold tracking-tight hover:text-gray-300">
          thelazylama.com
        </Link>

        {/* Nav Links */}
        <nav className="space-x-6">
          <Link href="/" className="hover:text-gray-300">
            Home
          </Link>
          <Link href="/store" className="hover:text-gray-300">
            Store
          </Link>
          <Link href="/experiments" className="hover:text-gray-300">
            Experiments
          </Link>
          <Link href="/about" className="hover:text-gray-300">
            About
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
