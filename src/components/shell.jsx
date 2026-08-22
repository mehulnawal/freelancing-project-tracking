import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  HelpCircle,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Drawer, Dropdown, IconButton, Modal } from "./ui";
import { getRouteMeta, routeMeta } from "../app/routes";
import { useTheme } from "../context/useTheme";
import { useSettings } from "../context/useSettings";

const groups = ["Overview", "Work", "Finance", "Secure"];
const Brand = ({ compact = false }) => {
  const { settings } = useSettings();
  const fallback = (
    <span className="monogram">{settings.shortName || "FM"}</span>
  );
  return (
    <Link className="brand" to="/dashboard">
      {settings.logoUrl ? (
        <img
          className="brand-logo"
          src={settings.logoUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        fallback
      )}
      {!compact && <span>{settings.brandName}</span>}
    </Link>
  );
};
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <IconButton
      label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}
function NavItems({ collapsed, onNavigate }) {
  return (
    <>
      {groups.map((group) => (
        <div className="nav-group" key={group}>
          <p>{!collapsed && group}</p>
          {routeMeta
            .filter((item) => item.group === group)
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className="nav-link"
                title={collapsed ? item.title : undefined}
              >
                <item.icon size={19} />
                <span>{!collapsed && item.title}</span>
              </NavLink>
            ))}
        </div>
      ))}
      <div className="nav-bottom">
        <NavLink to="/settings" onClick={onNavigate} className="nav-link">
          <Settings size={19} />
          <span>{!collapsed && "Settings"}</span>
        </NavLink>
      </div>
    </>
  );
}
export function Sidebar({ collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <Brand compact={collapsed} />
        <IconButton
          label="Collapse sidebar"
          className="collapse-button"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu size={18} />
        </IconButton>
      </div>
      <nav aria-label="Main navigation">
        <NavItems collapsed={collapsed} />
      </nav>
    </aside>
  );
}
export function Breadcrumbs() {
  const current = getRouteMeta(useLocation().pathname);
  return (
    <div className="breadcrumbs">
      <span className="crumb-root">Workspace</span>
      <span className="crumb-separator">/</span>
      <strong>{current.title}</strong>
    </div>
  );
}
function QuickAddMenu({ onClose }) {
  const navigate = useNavigate();
  const items = [
    ["Add Client", "/clients/new"],
    ["Add Project", "/projects/new"],
    ["Add Income", "/income/new"],
    ["Record Project Payment", "/income/new?type=project"],
    ["Add Account", "/accounts/new"],
    ["Transfer Money", "/accounts/transfer"],
  ];
  return (
    <Dropdown className="quick-menu">
      {items.map(([label, path]) => (
        <button
          key={label}
          onClick={() => {
            navigate(path);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </Dropdown>
  );
}
export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const routes = routeMeta.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()),
  );
  const actions = [
    ["Add Client", "/clients/new"],
    ["Add Project", "/projects/new"],
    ["Add Income", "/income/new"],
    ["Record Project Payment", "/income/new?type=project"],
    ["Add Account", "/accounts/new"],
    ["Transfer Money", "/accounts/transfer"],
  ].filter(([title]) => title.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal open={open} onClose={onClose} title="Go to a page">
      <input
        autoFocus
        className="input palette-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pages…"
      />
      <div className="palette-list">
        {routes.map((item) => (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              onClose();
            }}
          >
            <item.icon size={18} />
            {item.title}
          </button>
        ))}
        {actions.map(([title, path]) => (
          <button
            key={path}
            onClick={() => {
              navigate(path);
              onClose();
            }}
          >
            <Plus size={18} />
            {title}
          </button>
        ))}
      </div>
    </Modal>
  );
}
export function ShortcutHelp({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className="shortcut-list">
        <div>
          <dt>Open command palette</dt>
          <dd>Ctrl / Cmd K</dd>
        </div>
        <div>
          <dt>Toggle sidebar</dt>
          <dd>Ctrl / Cmd B</dd>
        </div>
        <div>
          <dt>Show shortcuts</dt>
          <dd>Shift / or ?</dd>
        </div>
        <div>
          <dt>Close menu or dialog</dt>
          <dd>Esc</dd>
        </div>
      </dl>
    </Modal>
  );
}
export function Topbar({ onMenu, onCommand, onShortcuts }) {
  const { logout } = useAuth();
  const [quick, setQuick] = useState(false);
  const [notify, setNotify] = useState(false);
  const [user, setUser] = useState(false);
  const current = getRouteMeta(useLocation().pathname);
  return (
    <header className="topbar">
      <div className="desktop-breadcrumb">
        <Breadcrumbs />
      </div>
      <div className="mobile-heading">
        <IconButton label="Open navigation" onClick={onMenu}>
          <Menu size={20} />
        </IconButton>
        <strong>{current.shortTitle || current.title}</strong>
      </div>
      <div className="top-actions">
        <button className="search-trigger" onClick={onCommand}>
          <Search size={17} />
          <span>Search…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="action-anchor">
          <button className="quick-add" onClick={() => setQuick(!quick)}>
            <Plus size={17} />
            <span>Quick Add</span>
            <ChevronDown size={15} />
          </button>
          {quick && <QuickAddMenu onClose={() => setQuick(false)} />}
        </div>
        <ThemeToggle />
        <div className="action-anchor">
          <IconButton label="Notifications" onClick={() => setNotify(!notify)}>
            <Bell size={18} />
          </IconButton>
          {notify && (
            <Dropdown className="notification-menu">
              <strong>Notifications</strong>
              <p>You’re all caught up.</p>
            </Dropdown>
          )}
        </div>
        <div className="action-anchor user-anchor">
          <button className="user-button" onClick={() => setUser(!user)}>
            <span>AD</span>
            <ChevronDown size={15} />
          </button>
          {user && (
            <Dropdown className="user-menu">
              <button onClick={() => setUser(false)}>
                <Settings size={16} />
                Settings
              </button>
              <button onClick={() => { logout(); setUser(false); }}>
                Logout
              </button>
            </Dropdown>
          )}
        </div>
        <IconButton
          label="Keyboard shortcuts"
          className="shortcuts-button"
          onClick={onShortcuts}
        >
          <HelpCircle size={18} />
        </IconButton>
      </div>
    </header>
  );
}
export function MobileNavigation({ onMore, onQuick }) {
  const location = useLocation();
  const nav = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/projects", label: "Projects" },
    { path: "/monthly-tracking", label: "Monthly" },
  ];
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {nav.slice(0, 2).map((item) => (
        <NavLink
          to={item.path}
          key={item.path}
          className={location.pathname === item.path ? "active" : ""}
        >
          {item.label}
        </NavLink>
      ))}
      <button className="mobile-add" aria-label="Quick add" onClick={onQuick}>
        <Plus size={21} />
      </button>
      {nav.slice(2).map((item) => (
        <NavLink
          to={item.path}
          key={item.path}
          className={location.pathname === item.path ? "active" : ""}
        >
          {item.label}
        </NavLink>
      ))}
      <button onClick={onMore}>More</button>
    </nav>
  );
}
export function MobileDrawer({ open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="drawer-head">
        <Brand />
        <IconButton label="Close navigation" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      <nav aria-label="Mobile main navigation">
        <NavItems onNavigate={onClose} />
      </nav>
    </Drawer>
  );
}
export function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("fm-sidebar") === "true",
  );
  const [drawer, setDrawer] = useState(false);
  const [command, setCommand] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    localStorage.setItem("fm-sidebar", collapsed);
  }, [collapsed]);
  useEffect(() => {
    const keydown = (event) => {
      const editing =
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
        event.target.isContentEditable;
      if (event.key === "Escape") {
        setDrawer(false);
        setCommand(false);
        setShortcuts(false);
        setQuick(false);
        return;
      }
      if (editing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommand(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setShortcuts(true);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="shell-main">
        <Topbar
          onMenu={() => setDrawer(true)}
          onCommand={() => setCommand(true)}
          onShortcuts={() => setShortcuts(true)}
        />
        <main className="page-content">{children}</main>
      </div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <MobileNavigation
        onMore={() => setDrawer(true)}
        onQuick={() => setQuick(!quick)}
      />
      {quick && (
        <div className="mobile-quick">
          <QuickAddMenu onClose={() => setQuick(false)} />
        </div>
      )}
      <CommandPalette open={command} onClose={() => setCommand(false)} />
      <ShortcutHelp open={shortcuts} onClose={() => setShortcuts(false)} />
    </div>
  );
}
