import { LocalConfigurationProvider } from "react-azure-config/server";

export async function GET() {
  // Use LocalConfigurationProvider for simple environment variable access
  const localProvider = new LocalConfigurationProvider();
  const config = localProvider.getConfiguration();

  return new Response(JSON.stringify(config), {
    headers: { "content-type": "application/json" },
  });
}