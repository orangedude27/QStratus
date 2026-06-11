"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Download } from "lucide-react"

import { ControllerNavigationBoundary } from "@/components/controller-navigation-boundary"
import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"

import { scanSteamGames, getDiscoveredGames, claimGame } from "@/lib/actions/games"
import { isStaticExport } from "@/lib/static-export"
import { GameType, DiscoveredGameType, ScanResult } from "@/lib/types"

export default function Discover() {
  const [discovered, setDiscovered] = useState<DiscoveredGameType[]>([])
  const [existing, setExisting] = useState<GameType[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (isStaticExport) return
    loadDiscovered()
  }, [])

  async function loadDiscovered() {
    setLoading(true)
    try {
      const result = await getDiscoveredGames()
      if (result) {
        setDiscovered(result.discovered)
        setExisting(result.existing)
      }
    } catch (err) {
      toast({
        title: "Failed to load discovered games",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleScan() {
    setScanning(true)
    try {
      const result = await scanSteamGames()
      if (result) {
        setDiscovered(result.discovered)
        setExisting(result.existing)
        toast({
          title: "Scan complete",
          description: `Found ${result.discovered.length} new games, ${result.existing.length} already in catalog.`,
        })
      }
    } catch (err) {
      toast({
        title: "Scan failed",
        description: "Could not scan Steam library. Make sure the library path is configured.",
        variant: "destructive",
      })
    } finally {
      setScanning(false)
    }
  }

  async function handleClaim(appid: string) {
    try {
      const game = await claimGame(appid)
      if (game) {
        setDiscovered((prev) => prev.filter((g) => g.appid.toString() !== appid))
        setExisting((prev) => [...prev, game])
        toast({
          title: "Game added to catalog",
          description: `${game.title} has been added to your library.`,
        })
      }
    } catch (err) {
      toast({
        title: "Failed to claim game",
        description: "Please try again later.",
        variant: "destructive",
      })
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return "Unknown"
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(0)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(0)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(1)} GB`
  }

  return (
    <div data-controller-scope='discover'>
      <ControllerNavigationBoundary
        backHref="/browse"
        scopeSelector="[data-controller-scope='discover']"
      />
      <main className='container mx-auto px-4 py-14 md:px-6 md:py-16'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-3xl font-bold'>Discover Steam Games</h2>
          <Button
            onClick={handleScan}
            disabled={scanning || loading}
            variant='outline'
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Library'}
          </Button>
        </div>

        <p className='text-muted-foreground mb-8'>
          Scan your Steam library to discover games. Claim them to add to your catalog.
        </p>

        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : discovered.length === 0 && existing.length === 0 ? (
          <div className='text-center py-20'>
            <Plus className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <h3 className='text-xl font-semibold mb-2'>No games found</h3>
            <p className='text-muted-foreground mb-6'>
              {scanning
                ? 'Scanning your Steam library...'
                : 'Click "Scan Library" to discover your Steam games.'}
            </p>
          </div>
        ) : (
          <>
            {discovered.length > 0 && (
              <section className='mb-12'>
                <h3 className='text-xl font-semibold mb-4'>
                  New Games ({discovered.length})
                </h3>
                <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
                  {discovered.map((game) => (
                    <div
                      key={game.appid}
                      className='rounded-lg border border-border bg-card overflow-hidden'
                    >
                      <div className='aspect-video w-full bg-muted flex items-center justify-center'>
                        <span className='text-muted-foreground text-sm'>AppID {game.appid}</span>
                      </div>
                      <CardContent className='p-4'>
                        <CardTitle className='mb-1 line-clamp-1'>{game.name}</CardTitle>
                        <CardDescription className='mb-3 line-clamp-2'>
                          {formatSize(game.sizeOnDisk)}
                        </CardDescription>
                        <Button
                          onClick={() => handleClaim(game.appid.toString())}
                          className='w-full'
                          size='sm'
                        >
                          <Plus className='h-4 w-4 mr-1' />
                          Claim
                        </Button>
                      </CardContent>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {existing.length > 0 && (
              <section>
                <h3 className='text-xl font-semibold mb-4'>
                  Already in Catalog ({existing.length})
                </h3>
                <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
                  {existing.map((game) => (
                    <HoverCard
                      key={game.GameID}
                      href={`/browse/${game.GameID}`}
                      className='h-full cursor-pointer gap-0 overflow-hidden rounded-lg py-0'
                      data-controller-focus=''
                    >
                      <div className='relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted'>
                        {game.s3?.[0] ? (
                          <img
                            src={game.s3[0]}
                            alt={game.title}
                            className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                          />
                        ) : (
                          <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
                            No image
                          </div>
                        )}
                      </div>
                      <CardContent className='flex grow flex-col px-4 py-3'>
                        <CardTitle className='mb-1 line-clamp-1 text-lg font-semibold transition-colors group-hover:text-primary'>
                          {game.title}
                        </CardTitle>
                        <CardDescription className='line-clamp-2'>
                          {game.sDescript}
                        </CardDescription>
                      </CardContent>
                    </HoverCard>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
