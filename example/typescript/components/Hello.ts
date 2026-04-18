interface GreetingProps {
  name: string
}

function Hello({ name }: GreetingProps): string {
  return `Hello, ${name}!`
}

export default Hello
