"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

const repositoryUrl = "https://github.com/BIAsia/c2d2c";

const pipelines = [
  {
    id: "01",
    name: "restore",
    route: "Figma → code",
    summary:
      "Eight steps from design link to merged MR: audit, plan, extract, build, regress, review motion, accept, clean up.",
    mark: "d2c",
  },
  {
    id: "02",
    name: "export",
    route: "code → Figma",
    summary:
      "Enumerate every state from source, bind every expressible value to tokens, then ask before componentizing.",
    mark: "c2d",
  },
  {
    id: "03",
    name: "govern",
    route: "code → code",
    summary:
      "Converge the system, migrate every caller, freeze the rules with a gate, remove the old path, write the law back.",
    mark: "outer ring",
  },
  {
    id: "04",
    name: "Token Sync",
    route: "Figma ↔ code",
    summary:
      "Pull variables and styles, preview bound foundations, then push safe edits back through an MR and CI gate.",
    mark: "push lane",
  },
];

const cases = [
  {
    id: "A",
    title: "Global search",
    meta: "Figma → code restore",
    className: "case-light",
  },
  {
    id: "B",
    title: "Chat inline",
    meta: "code → Figma export",
    className: "case-mid",
  },
  {
    id: "C",
    title: "Radius system",
    meta: "component governance",
    className: "case-deep",
  },
  {
    id: "D",
    title: "Token Sync",
    meta: "two-way circuit",
    className: "case-ink",
  },
];

function springLinear(bounce: number) {
  const points = 96;
  const values: number[] = [];
  const zeta = Math.min(1, Math.max(0.05, 1 - bounce));

  for (let index = 0; index <= points; index += 1) {
    const time = index / points;
    let value: number;

    if (bounce <= 0.001) {
      const frequency = 8;
      value =
        1 -
        Math.exp(-frequency * time) * (1 + frequency * time);
    } else {
      const damping = 6;
      const natural = damping / zeta;
      const damped = natural * Math.sqrt(1 - zeta * zeta);
      value =
        1 -
        Math.exp(-damping * time) *
          (Math.cos(damped * time) +
            (damping / damped) * Math.sin(damped * time));
    }

    values.push(Number(value.toFixed(4)));
  }

  values[points] = 1;
  return `linear(${values.join(",")})`;
}

function Chars({ children }: { children: string }) {
  return (
    <>
      {[...children].map((character, index) =>
        character === " " ? (
          " "
        ) : (
          <span
            className="ch"
            style={{ "--i": index } as CSSProperties}
            key={`${character}-${index}`}
          >
            {character}
          </span>
        ),
      )}
    </>
  );
}

function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`line-mask ${className}`} data-fx="lines">
      <span className="line-move">{children}</span>
    </span>
  );
}

export default function Home() {
  useEffect(() => {
    document.documentElement.classList.add("js");

    const stage = document.querySelector<HTMLElement>(".stage");
    stage?.style.setProperty("--spring", springLinear(0.1));
    stage?.style.setProperty("--spring-soft", springLinear(0.045));

    requestAnimationFrame(() => stage?.classList.add("a-in"));

    const groups = Array.from(
      document.querySelectorAll<HTMLElement>("[data-rv]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("a-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    groups.forEach((group) => observer.observe(group));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js");
    };
  }, []);

  return (
    <main className="stage" data-rvx>
      <header className="site-header grid">
        <a className="wordmark m hover-link" href="#top" aria-label="c2d2c home">
          c2d2c
        </a>
        <p className="header-tag m">Code-to-design-to-code</p>
        <nav className="site-nav m" aria-label="Primary navigation">
          <a className="hover-link" href="#system">
            System
          </a>
          <a className="hover-link" href="#pipelines">
            Pipelines
          </a>
          <a className="hover-link" href="#adopt">
            Adopt
          </a>
        </nav>
        <a
          className="repo-link m hover-link"
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-meta grid">
          <p className="m" data-fx="rise" style={{ "--i": 0 } as CSSProperties}>
            Claude Code plugin
          </p>
          <p className="m" data-fx="rise" style={{ "--i": 1 } as CSSProperties}>
            Figma plugin
          </p>
          <p className="m" data-fx="rise" style={{ "--i": 2 } as CSSProperties}>
            MIT license
          </p>
          <p
            className="m hero-meta-end"
            data-fx="rise"
            style={{ "--i": 3 } as CSSProperties}
          >
            BIAsia / c2d2c
          </p>
        </div>

        <h1 className="display hero-title" data-fx="chars">
          <Chars>c2d2c</Chars>
        </h1>

        <div className="hero-bottom grid">
          <p className="hero-lead" data-fx="blur">
            Code to design to code.
          </p>
          <p className="body hero-copy" data-fx="blur">
            Four pipelines closing the loop between Figma and a production
            codebase.
          </p>
          <a
            className="hero-cta m hover-link"
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            View the source <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <hr className="hairline" />

      <section className="loop-band grid" id="system" data-rv>
        <p className="loop-corner loop-corner-a m" data-fx="rise">
          c2d / export
        </p>
        <p className="loop-corner loop-corner-b m" data-fx="rise">
          d2c / restore
        </p>
        <p className="loop-corner loop-corner-c m" data-fx="rise">
          govern / outer ring
        </p>
        <p className="loop-corner loop-corner-d m" data-fx="rise">
          token sync / push lane
        </p>

        <div
          className="loop-figure"
          data-fx="pop"
          role="img"
          aria-label="c2d2c loop connecting code and Figma through export, restore, governance, and token sync"
        >
          <div className="orbit orbit-outer" aria-hidden="true" />
          <div className="orbit orbit-inner" aria-hidden="true" />
          <div className="orbit-node node-code m">CODE</div>
          <div className="orbit-node node-figma m">FIGMA</div>
          <div className="orbit-core">
            <span className="m">SOURCE OF TRUTH</span>
            <strong>tokens</strong>
          </div>
          <span className="orbit-label label-top m">GOVERN</span>
          <span className="orbit-label label-left m">EXPORT / C2D</span>
          <span className="orbit-label label-right m">RESTORE / D2C</span>
          <span className="orbit-label label-bottom m">SYNC VIA MR</span>
        </div>
      </section>

      <section className="statement grid" data-rv>
        <p className="statement-label m" data-fx="rise">
          The shape
        </p>
        <p className="statement-text" data-fx="lines">
          <span className="line-move">
            <span className="serif">c2d</span> and{" "}
            <span className="serif">d2c</span> are the two arcs. Govern is the
            outer ring that keeps the loop from drifting apart.
          </span>
        </p>
        <p className="body statement-note" data-fx="blur">
          The optional Token Sync plugin gives designers a controlled push lane
          back into code: edits arrive as merge requests, safe literals are
          written back, and ambiguous changes stay visible for human review.
        </p>
      </section>

      <section className="stats grid" data-rv aria-label="Project facts">
        <article className="stat" data-fx="pop" style={{ "--i": 0 } as CSSProperties}>
          <strong>04</strong>
          <p className="m">connected pipelines</p>
        </article>
        <article className="stat" data-fx="pop" style={{ "--i": 1 } as CSSProperties}>
          <strong>08</strong>
          <p className="m">restore steps</p>
        </article>
        <article className="stat" data-fx="pop" style={{ "--i": 2 } as CSSProperties}>
          <strong>03</strong>
          <p className="m">export hard rules</p>
        </article>
        <article className="stat" data-fx="pop" style={{ "--i": 3 } as CSSProperties}>
          <strong>05</strong>
          <p className="m">governance moves</p>
        </article>
      </section>

      <section className="pipelines" id="pipelines" data-rv>
        <div className="section-head grid">
          <p className="m" data-fx="rise">
            Pipeline index
          </p>
          <h2>
            <Reveal>The loop,</Reveal>
            <Reveal>operationalized.</Reveal>
          </h2>
          <p className="body" data-fx="blur">
            Three agent skills and one companion Figma plugin turn handoff into
            a governed circuit.
          </p>
        </div>

        <div className="pipeline-list">
          {pipelines.map((pipeline, index) => (
            <article
              className="pipeline-row grid"
              data-fx="rise"
              style={{ "--i": index } as CSSProperties}
              key={pipeline.id}
            >
              <p className="pipeline-id m">{pipeline.id}</p>
              <h3>{pipeline.name}</h3>
              <p className="pipeline-route m">{pipeline.route}</p>
              <p className="body pipeline-summary">{pipeline.summary}</p>
              <p className="pipeline-mark m">{pipeline.mark}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="laws grid" data-rv>
        <p className="laws-label m" data-fx="rise">
          Operating laws
        </p>
        <span className="quote-mark serif" aria-hidden="true">
          “
        </span>
        <div className="laws-copy">
          <p data-fx="lines">
            <span className="line-move">Code is the source of truth.</span>
          </p>
          <p data-fx="lines">
            <span className="line-move">Enumerate every state first.</span>
          </p>
          <p data-fx="lines">
            <span className="line-move">
              Governance = convergence + freezing.
            </span>
          </p>
        </div>
        <p className="body laws-note" data-fx="blur">
          These are workflow constraints, not decoration: plan review,
          off-system style review, and screenshot acceptance are explicit stop
          points.
        </p>
      </section>

      <section className="case-section" data-rv>
        <div className="case-heading grid">
          <p className="m" data-fx="rise">
            Worked cases
          </p>
          <h2 data-fx="lines">
            <span className="line-move">Production, not theory.</span>
          </h2>
          <p className="body" data-fx="blur">
            The repository includes one documented case for each pipeline.
          </p>
        </div>

        <div className="case-strip">
          {cases.map((item, index) => (
            <article
              className="case-card"
              data-fx="clip"
              style={{ "--i": index } as CSSProperties}
              key={item.id}
            >
              <div
                className={`case-cover ${item.className}`}
                data-label={`CASE ${item.id} · ${item.title}`}
              >
                <span className="case-letter">{item.id}</span>
                <span className="case-grid" aria-hidden="true" />
              </div>
              <div className="case-caption">
                <p className="m">Case {item.id}</p>
                <h3>{item.title}</h3>
                <p className="m">{item.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="adopt grid" id="adopt" data-rv>
        <div className="adopt-intro">
          <p className="m" data-fx="rise">
            Adoption
          </p>
          <h2>
            <Reveal>One project.</Reveal>
            <Reveal>One config.</Reveal>
            <Reveal>A closed loop.</Reveal>
          </h2>
        </div>

        <div className="adopt-table">
          <div className="adopt-row" data-fx="rise" style={{ "--i": 0 } as CSSProperties}>
            <p className="m">Install</p>
            <p className="body">
              Add the repository as a local Claude Code marketplace/plugin, or
              copy the individual skills.
            </p>
          </div>
          <div className="adopt-row" data-fx="rise" style={{ "--i": 1 } as CSSProperties}>
            <p className="m">Configure</p>
            <p className="body">
              Put <code>C2D2C.md</code> at the repository root. Every skill
              resolves its project-specific paths and tools from that file.
            </p>
          </div>
          <div className="adopt-row" data-fx="rise" style={{ "--i": 2 } as CSSProperties}>
            <p className="m">Connect</p>
            <p className="body">
              Map the design file, token source, regression route, gates, and
              merge-request tool to your codebase.
            </p>
          </div>
          <div className="adopt-row" data-fx="rise" style={{ "--i": 3 } as CSSProperties}>
            <p className="m">Freeze</p>
            <p className="body">
              Let the regression surface, token snapshot, CI gate, and written
              agent rules keep both sides aligned.
            </p>
          </div>
        </div>

        <a
          className="adopt-cta"
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
          data-fx="pop"
        >
          <span className="m">Read the repository</span>
          <strong>Start with C2D2C.md</strong>
          <span aria-hidden="true">↗</span>
        </a>
      </section>

      <footer className="site-footer">
        <hr className="hairline" />
        <div className="footer-meta grid">
          <p className="m">BIAsia / c2d2c</p>
          <p className="m">Code ↔ Figma</p>
          <a
            className="m hover-link"
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source ↗
          </a>
        </div>
        <p className="footer-word display" aria-label="c2d2c">
          c2d2c
        </p>
      </footer>
    </main>
  );
}
