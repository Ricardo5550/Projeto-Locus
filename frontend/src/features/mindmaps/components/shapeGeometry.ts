import type { BlockShape } from '../mindMapTypes';

type Point = {
  x: number;
  y: number;
};

export const shapePoints: Record<
  Exclude<BlockShape, 'circle' | 'square'>,
  Point[]
> = {
  triangle: [
    { x: 50, y: 3 },
    { x: 97, y: 97 },
    { x: 3, y: 97 },
  ],
  octagon: [
    { x: 30, y: 3 },
    { x: 70, y: 3 },
    { x: 97, y: 30 },
    { x: 97, y: 70 },
    { x: 70, y: 97 },
    { x: 30, y: 97 },
    { x: 3, y: 70 },
    { x: 3, y: 30 },
  ],
  star: [
    { x: 50, y: 3 },
    { x: 61, y: 35 },
    { x: 96, y: 35 },
    { x: 68, y: 56 },
    { x: 79, y: 92 },
    { x: 50, y: 71 },
    { x: 21, y: 92 },
    { x: 32, y: 56 },
    { x: 4, y: 35 },
    { x: 39, y: 35 },
  ],
};

export function roundedPolygonPath(points: Point[], radius: number) {
  const requestedRadius = Math.max(0, Math.min(radius, 24));

  const corners = points.map((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];

    const toPrevious = {
      x: previous.x - current.x,
      y: previous.y - current.y,
    };

    const toNext = {
      x: next.x - current.x,
      y: next.y - current.y,
    };

    const previousLength = Math.hypot(toPrevious.x, toPrevious.y);
    const nextLength = Math.hypot(toNext.x, toNext.y);

    const distance = Math.min(
      requestedRadius,
      previousLength * 0.45,
      nextLength * 0.45
    );

    return {
      current,
      start: {
        x: current.x + (toPrevious.x / previousLength) * distance,
        y: current.y + (toPrevious.y / previousLength) * distance,
      },
      end: {
        x: current.x + (toNext.x / nextLength) * distance,
        y: current.y + (toNext.y / nextLength) * distance,
      },
    };
  });

  const first = corners[0];
  let path = `M ${first.end.x} ${first.end.y}`;

  for (let index = 1; index <= corners.length; index += 1) {
    const corner = corners[index % corners.length];
    path += ` L ${corner.start.x} ${corner.start.y}`;
    path += ` Q ${corner.current.x} ${corner.current.y} ${corner.end.x} ${corner.end.y}`;
  }

  return `${path} Z`;
}
