/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Skull } from 'lucide-react';
import { MAP, TILE_SIZE, COLORS, TileType } from './constants';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null;

interface Position {
  x: number;
  y: number;
}

class Entity {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  direction: Direction = null;
  nextDirection: Direction = null;
  speed: number = 2;

  constructor(gridX: number, gridY: number) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.x = gridX * TILE_SIZE + TILE_SIZE / 2;
    this.y = gridY * TILE_SIZE + TILE_SIZE / 2;
  }

  canMove(dir: Direction, map: number[][]): boolean {
    if (!dir) return false;
    let nextGridX = this.gridX;
    let nextGridY = this.gridY;

    if (dir === 'UP') nextGridY--;
    if (dir === 'DOWN') nextGridY++;
    if (dir === 'LEFT') nextGridX--;
    if (dir === 'RIGHT') nextGridX++;

    if (nextGridY < 0 || nextGridY >= map.length || nextGridX < 0 || nextGridX >= map[0].length) return false;
    return map[nextGridY][nextGridX] !== TileType.WALL;
  }

  updatePosition(map: number[][]) {
    const centerX = this.gridX * TILE_SIZE + TILE_SIZE / 2;
    const centerY = this.gridY * TILE_SIZE + TILE_SIZE / 2;

    // Check if we are at the center of the tile (with a small epsilon for float safety)
    const atCenter = Math.abs(this.x - centerX) < this.speed && Math.abs(this.y - centerY) < this.speed;

    if (atCenter) {
      // Snap to exact center
      this.x = centerX;
      this.y = centerY;

      // Pacman-specific: check for pre-buffered turn
      if (this.nextDirection && this.canMove(this.nextDirection, map)) {
        this.direction = this.nextDirection;
        this.nextDirection = null;
      } else if (this.direction && !this.canMove(this.direction, map)) {
        this.direction = null;
      }
    }

    if (this.direction) {
      if (this.direction === 'UP') this.y -= this.speed;
      if (this.direction === 'DOWN') this.y += this.speed;
      if (this.direction === 'LEFT') this.x -= this.speed;
      if (this.direction === 'RIGHT') this.x += this.speed;

      // Update grid coordinates
      this.gridX = Math.floor(this.x / TILE_SIZE);
      this.gridY = Math.floor(this.y / TILE_SIZE);
    }
  }
}

class Ghost extends Entity {
  color: string;
  isMerging: boolean = false;
  merged: boolean = false;

  constructor(gridX: number, gridY: number, color: string) {
    super(gridX, gridY);
    this.color = color;
    this.speed = 2; 
  }

  updateAI(map: number[][]) {
    if (this.merged) return;

    // Speed up and ignore walls when merging
    const currentSpeed = this.isMerging ? 3 : 2;
    this.speed = currentSpeed;

    const targetX = 9 * TILE_SIZE + TILE_SIZE / 2;
    const targetY = 9 * TILE_SIZE + TILE_SIZE / 2;

    if (this.isMerging) {
      // Direct movement to center (ignoring walls)
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.x += Math.cos(angle) * this.speed;
      this.y += Math.sin(angle) * this.speed;

      // Update grid coordinates
      this.gridX = Math.floor(this.x / TILE_SIZE);
      this.gridY = Math.floor(this.y / TILE_SIZE);

      // Check if reached center
      const distToTarget = Math.hypot(this.x - targetX, this.y - targetY);
      if (distToTarget < 5) {
        this.merged = true;
        this.x = targetX;
        this.y = targetY;
        this.direction = null;
      }
      return;
    }

    const centerX = this.gridX * TILE_SIZE + TILE_SIZE / 2;
    const centerY = this.gridY * TILE_SIZE + TILE_SIZE / 2;
    const atCenter = Math.abs(this.x - centerX) < currentSpeed && Math.abs(this.y - centerY) < currentSpeed;

    if (atCenter || !this.direction) {
      this.x = centerX;
      this.y = centerY;
      const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      
      const available = directions.filter(d => {
        const isReverse = 
          (this.direction === 'UP' && d === 'DOWN') ||
          (this.direction === 'DOWN' && d === 'UP') ||
          (this.direction === 'LEFT' && d === 'RIGHT') ||
          (this.direction === 'RIGHT' && d === 'LEFT');
        
        return this.canMove(d, map) && (!isReverse || directions.filter(dir => this.canMove(dir, map)).length === 1);
      });

      if (available.length > 0) {
        if (this.direction && this.canMove(this.direction, map) && Math.random() < 0.7) {
        } else {
          this.direction = available[Math.floor(Math.random() * available.length)];
        }
      }
    }

    if (this.direction) {
      if (this.direction === 'UP') this.y -= this.speed;
      if (this.direction === 'DOWN') this.y += this.speed;
      if (this.direction === 'LEFT') this.x -= this.speed;
      if (this.direction === 'RIGHT') this.x += this.speed;

      this.gridX = Math.floor(this.x / TILE_SIZE);
      this.gridY = Math.floor(this.y / TILE_SIZE);
    }
  }
}

class UltimateGhost extends Ghost {
  constructor(gridX: number, gridY: number) {
    super(gridX, gridY, '#6c5ce7');
    this.speed = 3; // Faster than normal ghosts
    this.merged = true; // It's already the result of merging
  }

  updateChasingAI(map: number[][], pacman: Entity) {
    const centerX = this.gridX * TILE_SIZE + TILE_SIZE / 2;
    const centerY = this.gridY * TILE_SIZE + TILE_SIZE / 2;
    const atCenter = Math.abs(this.x - centerX) < this.speed && Math.abs(this.y - centerY) < this.speed;

    if (atCenter || !this.direction) {
      this.x = centerX;
      this.y = centerY;

      const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      
      // Simple BFS or Greedy towards Pacman
      const available = directions.filter(d => this.canMove(d, map));
      
      if (available.length > 0) {
        // Sort directions by distance to Pacman
        available.sort((a, b) => {
          let ax = this.gridX, ay = this.gridY;
          let bx = this.gridX, by = this.gridY;
          
          if (a === 'UP') ay--; if (a === 'DOWN') ay++; if (a === 'LEFT') ax--; if (a === 'RIGHT') ax++;
          if (b === 'UP') by--; if (b === 'DOWN') by++; if (b === 'LEFT') bx--; if (b === 'RIGHT') bx++;
          
          const distA = Math.hypot(ax - pacman.gridX, ay - pacman.gridY);
          const distB = Math.hypot(bx - pacman.gridX, by - pacman.gridY);
          return distA - distB;
        });

        // 80% chance to take the best path, 20% random to avoid getting stuck
        if (Math.random() < 0.8) {
          this.direction = available[0];
        } else {
          this.direction = available[Math.floor(Math.random() * available.length)];
        }
      }
    }

    if (this.direction) {
      if (this.direction === 'UP') this.y -= this.speed;
      if (this.direction === 'DOWN') this.y += this.speed;
      if (this.direction === 'LEFT') this.x -= this.speed;
      if (this.direction === 'RIGHT') this.x += this.speed;

      this.gridX = Math.floor(this.x / TILE_SIZE);
      this.gridY = Math.floor(this.y / TILE_SIZE);
    }
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'WON' | 'LOST'>('START');
  const [pelletsLeft, setPelletsLeft] = useState(0);
  const pelletImageRef = useRef<HTMLImageElement | null>(null);
  const successImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Preload pellet image
    const imgX = new Image();
    imgX.src = 'x.jpg';
    imgX.referrerPolicy = 'no-referrer';
    imgX.onload = () => {
      pelletImageRef.current = imgX;
    };

    // Preload success image
    const imgZ = new Image();
    imgZ.src = 'z.jpg';
    imgZ.referrerPolicy = 'no-referrer';
    imgZ.onload = () => {
      successImageRef.current = imgZ;
    };
  }, []);

  const gameData = useRef<{
    pacman: Entity | null;
    ghosts: Ghost[];
    ultimateGhost: UltimateGhost | null;
    map: number[][];
    animationId: number | null;
    mouthOpen: number;
    mouthDir: number;
    score: number;
  }>({
    pacman: null,
    ghosts: [],
    ultimateGhost: null,
    map: [],
    animationId: null,
    mouthOpen: 0,
    mouthDir: 0.1,
    score: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState === 'PLAYING') {
        const currentMap = gameData.current.map;
        let respawnedCount = 0;

        for (let y = 0; y < MAP.length; y++) {
          for (let x = 0; x < MAP[y].length; x++) {
            // If it was originally a pellet but is now empty
            if (MAP[y][x] === TileType.PELLET && currentMap[y][x] === TileType.EMPTY) {
              // Don't respawn on top of Pacman
              if (gameData.current.pacman && gameData.current.pacman.gridX === x && gameData.current.pacman.gridY === y) {
                continue;
              }
              currentMap[y][x] = TileType.PELLET;
              respawnedCount++;
            }
          }
        }

        if (respawnedCount > 0) {
          setPelletsLeft(prev => prev + respawnedCount);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameState]);

  const initGame = () => {
    const newMap = MAP.map(row => [...row]);
    let pCount = 0;
    let pacmanStart: Position = { x: 9, y: 15 };
    const ghostStarts: Position[] = [];

    for (let y = 0; y < newMap.length; y++) {
      for (let x = 0; x < newMap[y].length; x++) {
        if (newMap[y][x] === TileType.PELLET) pCount++;
        if (newMap[y][x] === TileType.PACMAN_START) pacmanStart = { x, y };
        if (newMap[y][x] === TileType.GHOST_START) ghostStarts.push({ x, y });
      }
    }

    gameData.current.map = newMap;
    gameData.current.pacman = new Entity(pacmanStart.x, pacmanStart.y);
    gameData.current.pacman.direction = 'LEFT'; // Start moving immediately
    gameData.current.pacman.nextDirection = 'LEFT';
    gameData.current.ghosts = ghostStarts.map((pos, i) => new Ghost(pos.x, pos.y, COLORS.GHOSTS[i % COLORS.GHOSTS.length]));
    gameData.current.ultimateGhost = null;
    gameData.current.mouthOpen = 0.2;
    gameData.current.score = 0;
    
    setScore(0);
    setPelletsLeft(pCount);
    setGameState('PLAYING');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!gameData.current.pacman) return;
    if (e.key === 'ArrowUp') gameData.current.pacman.nextDirection = 'UP';
    if (e.key === 'ArrowDown') gameData.current.pacman.nextDirection = 'DOWN';
    if (e.key === 'ArrowLeft') gameData.current.pacman.nextDirection = 'LEFT';
    if (e.key === 'ArrowRight') gameData.current.pacman.nextDirection = 'RIGHT';
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { pacman, ghosts, map } = gameData.current;
    if (!pacman) return;

    // Clear
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Map
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TileType.WALL) {
          ctx.fillStyle = COLORS.WALL;
          // Draw rounded wall blocks
          ctx.beginPath();
          ctx.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 6);
          ctx.fill();
        } else if (tile === TileType.PELLET) {
          if (pelletImageRef.current) {
            ctx.drawImage(pelletImageRef.current, px + 6, py + 6, 20, 20);
          } else {
            ctx.fillStyle = COLORS.PELLET;
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Update Pacman
    pacman.updatePosition(map);
    
    // Eat pellet
    if (map[pacman.gridY][pacman.gridX] === TileType.PELLET) {
      map[pacman.gridY][pacman.gridX] = TileType.EMPTY;
      gameData.current.score += 10;
      setScore(gameData.current.score);
      
      if (gameData.current.score >= 1800) {
        setGameState('WON');
      }

      setPelletsLeft(p => {
        if (p - 1 === 0) setGameState('WON');
        return p - 1;
      });
    }

    // Draw Pacman
    ctx.fillStyle = COLORS.PACMAN;
    ctx.beginPath();
    const radius = TILE_SIZE / 2 - 4;
    
    // Animate mouth
    gameData.current.mouthOpen += gameData.current.mouthDir;
    if (gameData.current.mouthOpen > 0.25 || gameData.current.mouthOpen < 0.05) {
      gameData.current.mouthDir *= -1;
    }

    let rotation = 0;
    if (pacman.direction === 'UP') rotation = -Math.PI / 2;
    if (pacman.direction === 'DOWN') rotation = Math.PI / 2;
    if (pacman.direction === 'LEFT') rotation = Math.PI;
    if (pacman.direction === 'RIGHT') rotation = 0;

    ctx.moveTo(pacman.x, pacman.y);
    ctx.arc(
      pacman.x, 
      pacman.y, 
      radius, 
      rotation + gameData.current.mouthOpen * Math.PI, 
      rotation + (2 - gameData.current.mouthOpen) * Math.PI
    );
    ctx.fill();

    // Update & Draw Ghosts
    ghosts.forEach(ghost => {
      if (gameData.current.score >= 1500) ghost.isMerging = true;
      
      ghost.updateAI(map);
      
      // Collision detection (only if not merged)
      if (!ghost.merged) {
        const dist = Math.hypot(pacman.x - ghost.x, pacman.y - ghost.y);
        if (dist < TILE_SIZE / 1.5 && !ghost.isMerging) {
          setGameState('LOST');
        }

        ctx.save();
        if (ghost.isMerging) ctx.globalAlpha = 0.6; // Make ghosts transparent when merging
        
        ctx.fillStyle = ghost.color;
        ctx.beginPath();
        // Simple ghost shape
        ctx.arc(ghost.x, ghost.y - 2, radius, Math.PI, 0);
        ctx.lineTo(ghost.x + radius, ghost.y + radius);
        ctx.lineTo(ghost.x - radius, ghost.y + radius);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(ghost.x - 4, ghost.y - 4, 3, 0, Math.PI * 2);
        ctx.arc(ghost.x + 4, ghost.y - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(ghost.x - 4, ghost.y - 4, 1.5, 0, Math.PI * 2);
        ctx.arc(ghost.x + 4, ghost.y - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
    });

    // Draw merged entity if all are merged
    const allMerged = ghosts.length > 0 && ghosts.every(g => g.merged);
    if (allMerged) {
      if (!gameData.current.ultimateGhost) {
        gameData.current.ultimateGhost = new UltimateGhost(9, 9);
      }
      
      const ug = gameData.current.ultimateGhost;
      ug.updateChasingAI(map, pacman);

      // Collision detection with Ultimate Ghost
      const dist = Math.hypot(pacman.x - ug.x, pacman.y - ug.y);
      if (dist < TILE_SIZE / 1.2) {
        setGameState('LOST');
      }

      ctx.fillStyle = '#6c5ce7'; // Purple for merged ghost
      ctx.beginPath();
      ctx.arc(ug.x, ug.y, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      
      // Big eyes for merged ghost
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(ug.x - 10, ug.y - 6, 8, 0, Math.PI * 2);
      ctx.arc(ug.x + 10, ug.y - 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(ug.x - 10, ug.y - 6, 4, 0, Math.PI * 2);
      ctx.arc(ug.x + 10, ug.y - 6, 4, 0, Math.PI * 2);
      ctx.fill();

      // Text indicator
      ctx.fillStyle = '#6c5ce7';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ULTIMATE GHOST', ug.x, ug.y + radius * 3);
    }

    if (gameState === 'PLAYING') {
      gameData.current.animationId = requestAnimationFrame(draw);
    }
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameData.current.animationId = requestAnimationFrame(draw);
    } else {
      if (gameData.current.animationId) cancelAnimationFrame(gameData.current.animationId);
    }
    return () => {
      if (gameData.current.animationId) cancelAnimationFrame(gameData.current.animationId);
    };
  }, [gameState]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F8F9FA]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white p-8 rounded-3xl shadow-xl border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800">Pacman</h1>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">Minimalist Edition</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Score</p>
            <p className="text-3xl font-mono font-bold text-emerald-500">{score.toString().padStart(5, '0')}</p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
          <canvas
            ref={canvasRef}
            width={MAP[0].length * TILE_SIZE}
            height={MAP.length * TILE_SIZE}
            className="block"
          />

          <AnimatePresence>
            {gameState !== 'PLAYING' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6"
              >
                {gameState === 'START' && (
                  <>
                    <div className="w-24 h-24 mb-6 overflow-hidden rounded-2xl shadow-md border border-gray-100">
                      <img 
                        src="czjj.jpg" 
                        alt="Start Icon" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails
                          e.currentTarget.src = 'https://picsum.photos/seed/start/200/200';
                        }}
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Play?</h2>
                    <p className="text-gray-500 mb-8 max-w-xs">Use arrow keys to move and eat all the pellets. Avoid the ghosts!</p>
                    <button
                      onClick={initGame}
                      className="px-8 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-colors shadow-lg"
                    >
                      Start Game
                    </button>
                  </>
                )}

                {gameState === 'WON' && (
                  <>
                    <div className="w-32 h-32 mb-6 overflow-hidden rounded-2xl shadow-lg border-4 border-emerald-100">
                      <img 
                        src="z.jpg" 
                        alt="Success" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://picsum.photos/seed/win/300/300';
                        }}
                      />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Victory!</h2>
                    <p className="text-gray-500 mb-8">Congratulations! You reached 1800 points!</p>
                    <button
                      onClick={initGame}
                      className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-full font-bold hover:bg-emerald-600 transition-colors shadow-lg"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Play Again
                    </button>
                  </>
                )}

                {gameState === 'LOST' && (
                  <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                      <Skull className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Game Over</h2>
                    <p className="text-gray-500 mb-8">The ghosts caught you. Final score: {score}</p>
                    <button
                      onClick={initGame}
                      className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-colors shadow-lg"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Try Again
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 flex justify-between items-center text-gray-400 text-sm font-medium">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-200 text-[10px]">↑↓←→</kbd> Move
            </span>
          </div>
          <p>Pellets Left: {pelletsLeft}</p>
        </div>
      </motion.div>
    </div>
  );
}
