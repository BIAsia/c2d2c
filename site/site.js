const motion = {
  duration: 0.85,
  bounce: 0.2,
};

function createSpringLinear({ duration, bounce }, samples = 60) {
  const zeta = Math.max(0.02, 1 - bounce);
  const omega0 = 12 / duration;
  const omegaD = omega0 * Math.sqrt(Math.max(0.001, 1 - zeta ** 2));
  const points = [];

  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * duration;
    const envelope = Math.exp(-zeta * omega0 * t);
    const ratio = zeta / Math.sqrt(Math.max(0.001, 1 - zeta ** 2));
    const value =
      1 -
      envelope *
        (Math.cos(omegaD * t) + ratio * Math.sin(omegaD * t));
    points.push(`${Number(value.toFixed(4))} ${Number(((index / samples) * 100).toFixed(2))}%`);
  }

  return `linear(${points.join(",")})`;
}

document.documentElement.style.setProperty(
  "--spring",
  createSpringLinear(motion),
);

document.querySelectorAll('[data-fx="lines"]').forEach((element) => {
  if (element.querySelector(":scope > .lm")) return;

  const children = [...element.children];
  if (children.length > 0) {
    children.forEach((child, index) => {
      child.classList.add("lm");
      child.style.setProperty("--i", index);
    });
    return;
  }

  const wrapper = document.createElement("span");
  wrapper.className = "lm";
  wrapper.textContent = element.textContent;
  element.replaceChildren(wrapper);
});

document.addEventListener("animationend", (event) => {
  if (
    !event.target ||
    typeof event.target.matches !== "function" ||
    !event.target.matches(".lm")
  ) {
    return;
  }
  event.target.closest('[data-fx="lines"]')?.classList.add("fx-done");
});

document.querySelectorAll("[data-rv]").forEach((group) => {
  const items = group.matches("[data-fx]")
    ? [group]
    : [...group.querySelectorAll("[data-fx]")];
  items.forEach((item, index) => item.style.setProperty("--i", index));
});

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (reducedMotion) {
  document.querySelectorAll("[data-rv], [data-rvx]").forEach((element) => {
    element.classList.add("a-in");
  });
  document.querySelectorAll('[data-fx="lines"]').forEach((element) => {
    element.classList.add("fx-done");
  });
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("a-in");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.08,
    },
  );

  document.querySelectorAll("[data-rv]").forEach((element) => {
    observer.observe(element);
  });

  requestAnimationFrame(() => {
    document.querySelector("[data-rvx]")?.classList.add("a-in");
  });
}

const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".primary-nav a")];

const navObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      if (link.hash === `#${visible.target.id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  },
  {
    rootMargin: "-42% 0px -48% 0px",
    threshold: [0, 0.1, 0.5],
  },
);

sections.forEach((section) => navObserver.observe(section));
