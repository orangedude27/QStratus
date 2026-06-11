"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Gamepad2 } from "lucide-react"

import { ControllerNavigationBoundary } from "@/components/controller-navigation-boundary"
import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

import { getGames, createManualGame, deleteGame } from "@/lib/actions/games"
import { isStaticExport } from "@/lib/static-export"
import { GameType } from "@/lib/types"

export default function Manage() {
  const [games, setGames] = useState<GameType[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    developer: "",
    genres: "",
    sDescript: "",
    lDescript: "",
    source: "manual",
  })

  useEffect(() => {
    if (isStaticExport) return
    loadGames()
  }, [])

  async function loadGames() {
    setLoading(true)
    try {
      const data = await getGames()
      if (data) {
        setGames(data)
      }
    } catch (err) {
      toast({
        title: "Failed to load games",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.title) {
      toast({
        title: "Title is required",
        variant: "destructive",
      })
      return
    }

    try {
      const game = await createManualGame({
        title: formData.title,
        developer: formData.developer || "Unknown",
        genres: formData.genres
          ? formData.genres.split(",").map((g) => g.trim()).filter(Boolean)
          : [],
        sDescript: formData.sDescript || formData.title,
        lDescript: formData.lDescript,
        source: formData.source as GameType["source"],
      })

      if (game) {
        setGames((prev) => [...prev, game])
        setDialogOpen(false)
        setFormData({
          title: "",
          developer: "",
          genres: "",
          sDescript: "",
          lDescript: "",
          source: "manual",
        })
        toast({
          title: "Game added",
          description: `${game.title} has been added to your catalog.`,
        })
      }
    } catch (err) {
      toast({
        title: "Failed to create game",
        variant: "destructive",
      })
    }
  }

  async function handleDelete(gameId: string) {
    const success = await deleteGame(gameId)
    if (success) {
      setGames((prev) => prev.filter((g) => g.GameID !== gameId))
      setDeleteConfirm(null)
      toast({
        title: "Game removed",
        description: "The game has been removed from your catalog.",
      })
    } else {
      toast({
        title: "Failed to delete game",
        variant: "destructive",
      })
    }
  }

  function getSourceBadge(source: GameType["source"]) {
    const colors = {
      steam: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "non-steam": "bg-green-500/20 text-green-400 border-green-500/30",
      manual: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      seed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    }
    const labels = {
      steam: "Steam",
      "non-steam": "Non-Steam",
      manual: "Manual",
      seed: "Seed",
    }
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[source]}`}>
        {labels[source]}
      </span>
    )
  }

  return (
    <div data-controller-scope='manage'>
      <ControllerNavigationBoundary
        backHref="/browse"
        scopeSelector="[data-controller-scope='manage']"
      />
      <main className='container mx-auto px-4 py-14 md:px-6 md:py-16'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-3xl font-bold'>Manage Games</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className='h-4 w-4 mr-2' />
                Add Game
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Game</DialogTitle>
                <DialogDescription>
                  Add a non-Steam game to your catalog.
                </DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 py-4'>
                <div className='grid gap-2'>
                  <Label htmlFor='title'>Title *</Label>
                  <Input
                    id='title'
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder='Game title'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='developer'>Developer</Label>
                  <Input
                    id='developer'
                    value={formData.developer}
                    onChange={(e) => setFormData({ ...formData, developer: e.target.value })}
                    placeholder='Developer name'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='genres'>Genres (comma-separated)</Label>
                  <Input
                    id='genres'
                    value={formData.genres}
                    onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
                    placeholder='Action, Adventure, RPG'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='source'>Source</Label>
                  <Select
                    value={formData.source}
                    onValueChange={(v) => setFormData({ ...formData, source: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='manual'>Manual</SelectItem>
                      <SelectItem value='non-steam'>Non-Steam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='sDescript'>Short Description</Label>
                  <Textarea
                    id='sDescript'
                    value={formData.sDescript}
                    onChange={(e) => setFormData({ ...formData, sDescript: e.target.value })}
                    placeholder='Short description'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='lDescript'>Long Description</Label>
                  <Textarea
                    id='lDescript'
                    value={formData.lDescript}
                    onChange={(e) => setFormData({ ...formData, lDescript: e.target.value })}
                    placeholder='Long description'
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant='outline' onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Add Game</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <p className='text-muted-foreground mb-8'>
          Manage your game catalog. Add manual entries or remove games.
        </p>

        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <Gamepad2 className='h-8 w-8 animate-pulse text-muted-foreground' />
          </div>
        ) : games.length === 0 ? (
          <div className='text-center py-20'>
            <Gamepad2 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <h3 className='text-xl font-semibold mb-2'>No games in catalog</h3>
            <p className='text-muted-foreground'>
              Add your first game to get started.
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
            {games.map((game) => (
              <div
                key={game.GameID}
                className='rounded-lg border border-border bg-card overflow-hidden relative group'
              >
                <div className='absolute top-2 right-2 z-10 flex gap-2'>
                  {getSourceBadge(game.source)}
                  <Button
                    variant='destructive'
                    size='icon'
                    className='h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'
                    onClick={() => setDeleteConfirm(game.GameID)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
                <HoverCard
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
              </div>
            ))}
          </div>
        )}

        {deleteConfirm && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
            <div className='bg-card p-6 rounded-lg max-w-sm mx-4'>
              <h3 className='text-lg font-semibold mb-2'>Remove Game?</h3>
              <p className='text-muted-foreground mb-4'>
                This will remove the game from your catalog. Game files will not be deleted.
              </p>
              <div className='flex gap-2 justify-end'>
                <Button variant='outline' onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant='destructive' onClick={() => handleDelete(deleteConfirm)}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
