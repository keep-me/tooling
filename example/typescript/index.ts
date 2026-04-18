import Hello from '@/components/Hello'
import { formatDate, add } from '@/utils'

const app = document.getElementById('app')

if (app) {
  const greeting = Hello('TypeScript')
  const today = formatDate(new Date())
  const sum = add(2, 3)

  app.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #333;">${greeting}</h1>
      <p style="color: #666;">Today is: ${today}</p>
      <p style="color: #666;">2 + 3 = ${sum}</p>
      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        This is a TypeScript example using:
        <ul>
          <li>ts-loader for compilation</li>
          <li>tsconfig.json for configuration</li>
          <li>Path aliases (@/components, @/utils)</li>
          <li>ForkTsCheckerWebpackPlugin for type checking</li>
        </ul>
      </p>
    </div>
  `
}
