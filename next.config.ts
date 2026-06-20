import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['simple-git'],
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
