/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15: serverExternalPackages replaces experimental.serverComponentsExternalPackages
  serverExternalPackages: ['pdfkit', 'pdf-parse', 'mammoth'],
}
module.exports = nextConfig
