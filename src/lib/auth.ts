import { cookies } from 'next/headers'

export async function getDriverId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('driver_id')?.value ?? null
}
