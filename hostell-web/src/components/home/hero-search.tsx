"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/icons";
import { PROPERTY_TYPES } from "@/lib/listings/types";
import { useDiscovery } from "./discovery-context";
import styles from "./home.module.css";

type Option = { value: string; label: string };

const TYPE_OPTIONS: Option[] = [{ value: "", label: "Any type" }, ...PROPERTY_TYPES.map((t) => ({ value: t, label: t }))];

const SHARING_OPTIONS: Option[] = [
  { value: "", label: "Any sharing" },
  { value: "1", label: "1 Sharing" },
  { value: "2", label: "2 Sharing" },
  { value: "3", label: "3 Sharing" },
  { value: "4", label: "4 Sharing" },
  { value: "5", label: "5 Sharing" },
  { value: "more", label: "6 & more" },
];

type SelectProps = {
  label: string;
  icon: IconName;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

/** A styled listbox, because the browser's own option list cannot be padded or themed consistently. */
function SearchSelect({ label, icon, options, value, onChange }: SelectProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    setActive(selected);
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i].value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openMenu();
      setActive((i) => Math.min(options.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" || e.key === " ") {
      if (!open) return; // the button's own click opens it
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.searchField} ref={root}>
      <span id={`${id}-label`} className={styles.searchLabel}>
        <Icon name={icon} size={15} />
        {label}
      </span>
      <button
        type="button"
        className={styles.selectButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span id={`${id}-value`}>{options[selected].label}</span>
        <span className={styles.selectChevron} data-open={open} aria-hidden="true">
          <Icon name="chevron" size={16} />
        </span>
      </button>
      {open && (
        <ul className={styles.selectMenu} role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === selected}
              className={i === active ? `${styles.selectOption} ${styles.selectOptionActive}` : styles.selectOption}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              {o.label}
              {i === selected && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeroSearch() {
  const { draft, setDraft, typeDraft, setTypeDraft, sharingDraft, setSharingDraft, applySearch } = useDiscovery();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    applySearch();
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form className={styles.search} role="search" onSubmit={onSubmit}>
      <div className={`${styles.searchField} ${styles.searchWide}`}>
        <label htmlFor="hero-location" className={styles.searchLabel}>
          <Icon name="pin" size={15} />
          Locality
        </label>
        <input
          id="hero-location"
          name="location"
          type="search"
          className={styles.searchInput}
          placeholder="e.g. Madhapur"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <SearchSelect label="Property Type" icon="building" options={TYPE_OPTIONS} value={typeDraft} onChange={setTypeDraft} />
      <SearchSelect label="Sharing Type" icon="people" options={SHARING_OPTIONS} value={sharingDraft} onChange={setSharingDraft} />
      <button type="submit" className={styles.searchButton}>
        <Icon name="search" size={20} />
        Search Stays
      </button>
    </form>
  );
}
