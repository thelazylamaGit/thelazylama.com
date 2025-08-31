import React from 'react'

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between p-4 sm:flex-row">
        <p className="text-sm">&copy; {new Date().getFullYear()} MySite. All rights reserved.</p>
        <div className="mt-2 space-x-4 sm:mt-0">
          <a href="https://twitter.com/" className="hover:text-white">
            Twitter
          </a>
          <a href="https://github.com/" className="hover:text-white">
            GitHub
          </a>
          <a href="/contact" className="hover:text-white">
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
