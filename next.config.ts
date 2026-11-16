import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './lib/sanity-image-loader.ts',
    deviceSizes: [400, 480, 640, 750, 828, 1080, 1200, 1440, 1920, 2560, 3200, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
