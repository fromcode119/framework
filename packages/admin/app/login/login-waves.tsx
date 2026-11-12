import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';

/**
 * The flowing ribbons behind the sign-in's help column.
 *
 * Six cubic curves whose control points drift on slow sine/cosine clocks, stroked with one shared
 * gradient. The colours are the `--fc-login-wave-1…5` tokens in `login.css`, so an appearance restyles
 * them from its own stylesheet; nothing here names a colour. A visitor who asked the system for reduced
 * motion gets the first frame and no loop.
 */
export class LoginWaves extends Reactor {
  /** `[y0, y3, c1, c2, width, speed, phase, look]` for each ribbon. */
  private static readonly LINES: ReadonlyArray<readonly [number, number, number, number, number, number, number, string]> = [
    [980, 120, 760, 360, 150, 0.22, 0, 'blur'],
    [900, 40, 820, 180, 86, 0.3, 1.4, ''],
    [1040, 260, 640, 420, 54, 0.26, 2.6, ''],
    [820, -40, 700, 120, 14, 0.38, 3.3, 'thin'],
    [1120, 330, 900, 520, 110, 0.18, 4.1, ''],
    [960, 180, 560, 260, 120, 0.24, 5.2, 'blur'],
  ];

  private readonly paths: Array<SVGPathElement | null> = [];
  private frame = 0;
  private startedAt = 0;

  componentDidMount(): void {
    this.draw(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.startedAt = performance.now();
    const tick = (now: number) => {
      this.draw((now - this.startedAt) / 1000);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  componentWillUnmount(): void {
    cancelAnimationFrame(this.frame);
  }

  private static pathAt(line: (typeof LoginWaves.LINES)[number], t: number): string {
    const [y0, y3, c1, c2, , speed, phase] = line;
    const a = Math.sin(t * speed + phase);
    const b = Math.cos(t * speed * 0.8 + phase);
    return `M -200 ${y0 + a * 30} C 320 ${c1 + a * 90}, 760 ${c2 + b * 110}, 1400 ${y3 + b * 40}`;
  }

  private draw(t: number): void {
    LoginWaves.LINES.forEach((line, index) => {
      this.paths[index]?.setAttribute('d', LoginWaves.pathAt(line, t));
    });
  }

  render(): ReactNode {
    return (
      <svg className="fc-login__waves" viewBox="0 0 1200 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="fc-login-wave" gradientUnits="userSpaceOnUse" x1="100" y1="900" x2="1100" y2="0">
            <stop offset="0" stopColor="var(--fc-login-wave-1)" />
            <stop offset="0.3" stopColor="var(--fc-login-wave-2)" />
            <stop offset="0.55" stopColor="var(--fc-login-wave-3)" />
            <stop offset="0.78" stopColor="var(--fc-login-wave-4)" />
            <stop offset="1" stopColor="var(--fc-login-wave-5)" />
          </linearGradient>
        </defs>
        {LoginWaves.LINES.map((line, index) => (
          <path
            key={index}
            ref={(el) => { this.paths[index] = el; }}
            className={line[7] ? `fc-login__wave fc-login__wave--${line[7]}` : 'fc-login__wave'}
            d={LoginWaves.pathAt(line, 0)}
            stroke="url(#fc-login-wave)"
            strokeWidth={line[4]}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </svg>
    );
  }
}
