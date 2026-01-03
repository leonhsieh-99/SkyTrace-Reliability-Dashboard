export default async function fetchHr(hr: string) {
    const BASE_URL = "https://a.windbornesystems.com/treasure";
  
    const res = await fetch(`${BASE_URL}/${hr}.json`, {
      cache: "no-store",
    });
  
    if (!res.ok) {
      throw new Error(`Failed to fetch hour ${hr}: ${res.status}`);
    }
  
    return res.json();
}