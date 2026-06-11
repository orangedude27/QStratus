import { GameType, DiscoveredGameType, ScanResult } from "../types"
import { getBackendPath } from "@/lib/backend/getBackendPath"


export async function getGames() {
  try {
    const response = await fetch(getBackendPath("/games"), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error body:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType[] = await response.json();

    return data;
  } catch (error) {
    
  }
}

export async function getGameById(id: string) {
  try {
    const response = await fetch(getBackendPath(`/games/${id}`), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error body:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType = await response.json();
    if (!data) {
    throw new Error(`Game with id ${id} not found`)
    }
    return data;
  } catch (error) {
    return null;
  }
  
}

export async function scanSteamGames(): Promise<ScanResult | null> {
  try {
    const response = await fetch(getBackendPath("/games/scan"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error scanning Steam library:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: ScanResult = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to scan Steam library:", error);
    return null;
  }
}

export async function getDiscoveredGames(): Promise<ScanResult | null> {
  try {
    const response = await fetch(getBackendPath("/games/discovered"), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching discovered games:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: ScanResult = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch discovered games:", error);
    return null;
  }
}

export async function claimGame(appid: string): Promise<GameType | null> {
  try {
    const response = await fetch(getBackendPath(`/games/discovered/${appid}/claim`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error claiming game:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to claim game:", error);
    return null;
  }
}

export async function createManualGame(gameData: Partial<GameType>): Promise<GameType | null> {
  try {
    const response = await fetch(getBackendPath("/games"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameData),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error creating game:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to create game:", error);
    return null;
  }
}

export async function deleteGame(gameId: string): Promise<boolean> {
  try {
    const response = await fetch(getBackendPath(`/games/${gameId}`), {
      method: "DELETE",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error deleting game:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("Failed to delete game:", error);
    return false;
  }
}
