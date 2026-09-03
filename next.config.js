/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'pdf-parse', 'mammoth']
  }
}
module.exports = nextConfig
