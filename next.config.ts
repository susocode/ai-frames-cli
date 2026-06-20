import type { NextConfig } from 'next'
import path from 'path'
import pkg from './package.json'

const nextConfig: NextConfig = {
  serverExternalPackages: ['simple-git'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
}

export default nextConfig
