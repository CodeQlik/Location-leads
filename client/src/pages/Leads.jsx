import { useEffect, useMemo, useState } from "react";
import { getLeads } from "../api/leadsApi";

export default function Leads({ token, authUser }) {
    const [leads, setLeads] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => new Date());
    const [filters, setFilters] = useState({
        search: "",
        category: "",
        city: "",
        minRating: "",
        datePreset: "",
        dateFrom: "",
        dateTo: "",
        hasPhone: false,
        hasEmail: false,
        hasWebsite: false,
    });
    const canExportCsv = authUser?.role === "admin" && authUser?.department === "admin"
        ? true
        : authUser?.permissions?.canExportCsv ?? true;

    const loadLeads = async (page = 1) => {
        try {
            setLoading(true);
            setSelectedIds([]);
            const res = await getLeads(token, page, 50);
            setLeads(res.data.leads || []);
            setPagination(res.data.pagination || pagination);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to load leads");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadLeads(1);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const totalShowing = Math.min(pagination.page * 50, pagination.total);
    const startEntry = (pagination.page - 1) * 50 + 1;
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const getLeadId = (lead) => lead._id || lead.id;
    const ratingValue = (rating) => {
        if (typeof rating === "number") return rating;
        const match = String(rating || "").match(/[\d.]+/);
        return match ? Number(match[0]) : 0;
    };
    const normalize = (value) => String(value || "").toLowerCase();
    const toDateInputValue = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };
    const formatDisplayDate = (value) => {
        if (!value) return "";
        return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };
    const startOfDay = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const endOfDay = (date) => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    };
    const getPresetRange = (preset) => {
        if (!preset) return {};

        const today = new Date();

        if (preset === "today") {
            return { from: startOfDay(today), to: endOfDay(today) };
        }

        if (preset === "yesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
        }

        if (preset === "last7") {
            const from = startOfDay(today);
            from.setDate(today.getDate() - 6);
            return { from, to: endOfDay(today) };
        }

        if (preset === "last30") {
            const from = startOfDay(today);
            from.setDate(today.getDate() - 29);
            return { from, to: endOfDay(today) };
        }

        return {};
    };

    const filteredLeads = useMemo(() => {
        const search = normalize(filters.search);
        const category = normalize(filters.category);
        const city = normalize(filters.city);
        const minRating = filters.minRating ? Number(filters.minRating) : 0;
        const presetRange = getPresetRange(filters.datePreset);
        const dateFrom = filters.dateFrom ? startOfDay(filters.dateFrom) : presetRange.from;
        const dateTo = filters.dateTo ? endOfDay(filters.dateTo) : presetRange.to;

        return leads.filter((lead) => {
            const searchable = [
                lead.name,
                lead.category,
                lead.address,
                lead.phone,
                lead.email,
                lead.website,
                lead.rating,
                lead.reviews,
            ].map(normalize).join(" ");

            if (search && !searchable.includes(search)) return false;
            if (category && !normalize(lead.category).includes(category)) return false;
            if (city && !normalize(lead.address).includes(city)) return false;
            if (minRating && ratingValue(lead.rating) < minRating) return false;
            if (dateFrom || dateTo) {
                const scrapeDate = lead.lastScrapedAt || lead.createdAt;
                const scrapedAt = scrapeDate ? new Date(scrapeDate) : null;

                if (!scrapedAt || Number.isNaN(scrapedAt.getTime())) return false;
                if (dateFrom && scrapedAt < dateFrom) return false;
                if (dateTo && scrapedAt > dateTo) return false;
            }
            if (filters.hasPhone && !lead.phone) return false;
            if (filters.hasEmail && !lead.email) return false;
            if (filters.hasWebsite && !lead.website) return false;

            return true;
        });
    }, [leads, filters]);

    const visibleIds = filteredLeads.map(getLeadId).filter(Boolean);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
    const selectedLeads = leads.filter((lead) => selectedSet.has(getLeadId(lead)));

    const updateFilter = (key, value) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const updateDatePreset = (value) => {
        setDatePickerOpen(false);
        setFilters((current) => ({
            ...current,
            datePreset: value,
            dateFrom: "",
            dateTo: "",
        }));
    };

    const updateDateRange = (dateValue) => {
        setFilters((current) => {
            if (!current.dateFrom || (current.dateFrom && current.dateTo)) {
                return {
                    ...current,
                    datePreset: "",
                    dateFrom: dateValue,
                    dateTo: "",
                };
            }

            if (dateValue < current.dateFrom) {
                return {
                    ...current,
                    datePreset: "",
                    dateFrom: dateValue,
                    dateTo: current.dateFrom,
                };
            }

            return {
                ...current,
                datePreset: "",
                dateTo: dateValue,
            };
        });
    };

    const clearFilters = () => {
        setDatePickerOpen(false);
        setFilters({
            search: "",
            category: "",
            city: "",
            minRating: "",
            datePreset: "",
            dateFrom: "",
            dateTo: "",
            hasPhone: false,
            hasEmail: false,
            hasWebsite: false,
        });
    };

    const clearDateRange = () => {
        setFilters((current) => ({
            ...current,
            datePreset: "",
            dateFrom: "",
            dateTo: "",
        }));
    };

    const dateRangeLabel = () => {
        if (filters.datePreset) {
            const labels = {
                today: "Today",
                yesterday: "Yesterday",
                last7: "Last 7 days",
                last30: "Last 30 days",
            };

            return labels[filters.datePreset] || "Any scrape date";
        }

        if (filters.dateFrom && filters.dateTo) {
            return `${formatDisplayDate(filters.dateFrom)} - ${formatDisplayDate(filters.dateTo)}`;
        }

        if (filters.dateFrom) {
            return `${formatDisplayDate(filters.dateFrom)} - Select end`;
        }

        return "Any scrape date";
    };

    const calendarDays = useMemo(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() - firstDay.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);

            return {
                date,
                value: toDateInputValue(date),
                inMonth: date.getMonth() === month,
            };
        });
    }, [calendarMonth]);

    const changeCalendarMonth = (direction) => {
        setCalendarMonth((current) => {
            const next = new Date(current);
            next.setMonth(current.getMonth() + direction);
            return next;
        });
    };

    const toggleLeadSelection = (leadId) => {
        setSelectedIds((current) =>
            current.includes(leadId)
                ? current.filter((id) => id !== leadId)
                : [...current, leadId]
        );
    };

    const toggleVisibleSelection = () => {
        setSelectedIds((current) => {
            const currentSet = new Set(current);

            if (allVisibleSelected) {
                visibleIds.forEach((id) => currentSet.delete(id));
            } else {
                visibleIds.forEach((id) => currentSet.add(id));
            }

            return Array.from(currentSet);
        });
    };

    const exportSelectedLeads = () => {
        if (selectedLeads.length === 0) return;

        const headers = ["Business", "Rating", "Reviews", "Category", "Address", "Phone", "Email", "Website", "Scraped Date"];
        const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const rows = selectedLeads.map((lead) => [
            lead.name,
            lead.rating,
            lead.reviews,
            lead.category,
            lead.address,
            lead.phone,
            lead.email,
            lead.website,
            lead.lastScrapedAt || lead.createdAt ? new Date(lead.lastScrapedAt || lead.createdAt).toLocaleString() : "",
        ].map(escapeCsvValue).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `selected-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={S.wrapper}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                .leads-root * {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    box-sizing: border-box;
                }

                .lead-row {
                    transition: background 0.15s ease;
                }
                .lead-row:hover {
                    background: #fff7f4 !important;
                }

                .page-btn:hover:not(:disabled) {
                    background: #fff7f4 !important;
                    border-color: rgba(255,107,53,0.4) !important;
                    color: #ff6b35 !important;
                }

                .page-btn:disabled {
                    opacity: 0.38;
                    cursor: not-allowed;
                }

                .skeleton-line {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.4s infinite;
                    border-radius: 6px;
                }

                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                .leads-table-wrap {
                    overflow-x: visible;
                    overflow-y: visible;
                }

                .website-link {
                    display: inline;
                    color: #ff6b35;
                    font-weight: 600;
                    font-size: 12px;
                    text-decoration: none;
                    word-break: break-all;
                    transition: all 0.15s ease;
                }
                .website-link:hover {
                    color: #e65a28;
                    text-decoration: underline;
                }

                .rating-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-weight: 700;
                    font-size: 12px;
                }

                .category-tag {
                    display: inline-flex;
                    align-items: center;
                    background: #f1f5f9;
                    color: #475569;
                    border-radius: 6px;
                    padding: 4px 8px;
                    font-size: 11.5px;
                    font-weight: 600;
                    white-space: normal;
                    overflow-wrap: anywhere;
                    max-width: 135px;
                    line-height: 1.22;
                }

                .lead-checkbox {
                    width: 14px;
                    height: 14px;
                    accent-color: #ff6b35;
                    cursor: pointer;
                }
            `}</style>

            <div className="leads-root" style={{ width: "100%" }}>
                {/* Header */}
                <div style={S.header}>
                    <div>
                        <div style={S.titleRow}>
                            <div style={S.titleIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                                    <rect x="9" y="3" width="6" height="4" rx="1" />
                                    <line x1="9" y1="12" x2="15" y2="12" />
                                    <line x1="9" y1="16" x2="13" y2="16" />
                                </svg>
                            </div>
                            <h1 style={S.title}>Leads</h1>
                        </div>
                        <p style={S.sub}>
                            {!loading && pagination.total > 0
                                ? `Showing ${startEntry}–${totalShowing} of ${pagination.total.toLocaleString()} business leads`
                                : "List of business leads"}
                        </p>
                    </div>

                    {!loading && pagination.total > 0 && (
                        <div style={S.statsRow}>
                            <div style={S.statPill}>
                                <span style={S.statNum}>{pagination.total.toLocaleString()}</span>
                                <span style={S.statLabel}>Total</span>
                            </div>
                            <div style={S.statPill}>
                                <span style={S.statNum}>{pagination.totalPages}</span>
                                <span style={S.statLabel}>Pages</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Card */}
                <div style={S.card}>
                    {!loading && leads.length > 0 && (
                        <div style={S.filterPanel}>
                            <div style={S.filterGrid}>
                                <input
                                    style={{ ...S.filterInput, gridColumn: "span 2" }}
                                    placeholder="Search name, phone, email, website..."
                                    value={filters.search}
                                    onChange={(e) => updateFilter("search", e.target.value)}
                                />
                                <input
                                    style={S.filterInput}
                                    placeholder="Category"
                                    value={filters.category}
                                    onChange={(e) => updateFilter("category", e.target.value)}
                                />
                                <input
                                    style={S.filterInput}
                                    placeholder="City / address"
                                    value={filters.city}
                                    onChange={(e) => updateFilter("city", e.target.value)}
                                />
                                <select
                                    style={S.filterInput}
                                    value={filters.minRating}
                                    onChange={(e) => updateFilter("minRating", e.target.value)}
                                >
                                    <option value="">Any rating</option>
                                    <option value="3">3+ stars</option>
                                    <option value="4">4+ stars</option>
                                    <option value="4.5">4.5+ stars</option>
                                </select>
                                <select
                                    style={S.filterInput}
                                    value={filters.datePreset}
                                    onChange={(e) => updateDatePreset(e.target.value)}
                                >
                                    <option value="">Any scrape date</option>
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="last7">Last 7 days</option>
                                    <option value="last30">Last 30 days</option>
                                </select>
                                <div style={{ ...S.dateRangeWrap, gridColumn: "span 2" }}>
                                    <button
                                        type="button"
                                        style={S.dateRangeBtn}
                                        onClick={() => setDatePickerOpen((open) => !open)}
                                    >
                                        {dateRangeLabel()}
                                        <span style={S.dateChevron}>⌄</span>
                                    </button>

                                    {datePickerOpen && (
                                        <div style={S.calendarPanel}>
                                            <div style={S.calendarHeader}>
                                                <button type="button" style={S.calendarNavBtn} onClick={() => changeCalendarMonth(-1)}>
                                                    ‹
                                                </button>
                                                <span style={S.calendarTitle}>
                                                    {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                                                </span>
                                                <button type="button" style={S.calendarNavBtn} onClick={() => changeCalendarMonth(1)}>
                                                    ›
                                                </button>
                                            </div>

                                            <div style={S.weekdayGrid}>
                                                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                                                    <span key={`${day}-${index}`} style={S.weekday}>{day}</span>
                                                ))}
                                            </div>

                                            <div style={S.dayGrid}>
                                                {calendarDays.map((day) => {
                                                    const selectedStart = filters.dateFrom === day.value;
                                                    const selectedEnd = filters.dateTo === day.value;
                                                    const inRange = filters.dateFrom && filters.dateTo && day.value > filters.dateFrom && day.value < filters.dateTo;

                                                    return (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            style={{
                                                                ...S.dayBtn,
                                                                ...(!day.inMonth ? S.dayBtnMuted : {}),
                                                                ...(inRange ? S.dayBtnRange : {}),
                                                                ...(selectedStart || selectedEnd ? S.dayBtnSelected : {}),
                                                            }}
                                                            onClick={() => updateDateRange(day.value)}
                                                        >
                                                            {day.date.getDate()}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div style={S.calendarFooter}>
                                                <button type="button" style={S.lightBtn} onClick={clearDateRange}>
                                                    Clear dates
                                                </button>
                                                <button type="button" style={S.applyDateBtn} onClick={() => setDatePickerOpen(false)}>
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={S.filterActions}>
                                <label style={S.checkLabel}>
                                    <input
                                        type="checkbox"
                                        className="lead-checkbox"
                                        checked={filters.hasPhone}
                                        onChange={(e) => updateFilter("hasPhone", e.target.checked)}
                                    />
                                    Phone
                                </label>
                                <label style={S.checkLabel}>
                                    <input
                                        type="checkbox"
                                        className="lead-checkbox"
                                        checked={filters.hasEmail}
                                        onChange={(e) => updateFilter("hasEmail", e.target.checked)}
                                    />
                                    Email
                                </label>
                                <label style={S.checkLabel}>
                                    <input
                                        type="checkbox"
                                        className="lead-checkbox"
                                        checked={filters.hasWebsite}
                                        onChange={(e) => updateFilter("hasWebsite", e.target.checked)}
                                    />
                                    Website
                                </label>

                                <button style={S.lightBtn} onClick={clearFilters}>Clear</button>
                                {canExportCsv && (
                                    <button
                                        style={{
                                            ...S.exportBtn,
                                            opacity: selectedLeads.length === 0 ? 0.45 : 1,
                                            cursor: selectedLeads.length === 0 ? "not-allowed" : "pointer",
                                        }}
                                        onClick={exportSelectedLeads}
                                        disabled={selectedLeads.length === 0}
                                    >
                                        Export CSV ({selectedLeads.length})
                                    </button>
                                )}
                            </div>

                            <div style={S.filterMeta}>
                                Showing {filteredLeads.length} of {leads.length} leads on this page
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div style={{ padding: "8px 0" }}>
                            {/* Skeleton header */}
                            <div style={{ display: "flex", gap: "16px", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", marginBottom: "4px" }}>
                                {[40, 160, 60, 70, 120, 200, 100, 140, 80].map((w, i) => (
                                    <div key={i} className="skeleton-line" style={{ height: "10px", width: `${w}px`, flexShrink: 0 }} />
                                ))}
                            </div>
                            {/* Skeleton rows */}
                            {Array.from({ length: 8 }).map((_, ri) => (
                                <div key={ri} style={{ display: "flex", gap: "16px", padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                                    {[40, 160, 60, 70, 120, 200, 100, 140, 80].map((w, ci) => (
                                        <div key={ci} className="skeleton-line" style={{ height: "13px", width: `${w}px`, flexShrink: 0, opacity: 0.6 + ri * 0.02 }} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : leads.length === 0 ? (
                        <div style={S.emptyState}>
                            <div style={S.emptyIcon}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                                    <rect x="9" y="3" width="6" height="4" rx="1" />
                                </svg>
                            </div>
                            <p style={{ margin: 0, color: "#94a3b8", fontWeight: "600", fontSize: "14px" }}>No leads found</p>
                            <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "13px" }}>Generate leads using the Lead Generator</p>
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div style={S.emptyState}>
                            <div style={S.emptyIcon}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="M21 21l-4.35-4.35" />
                                </svg>
                            </div>
                            <p style={{ margin: 0, color: "#94a3b8", fontWeight: "600", fontSize: "14px" }}>No leads match these filters</p>
                            <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "13px" }}>Clear filters or try a broader search</p>
                        </div>
                    ) : (
                        <>
                            <div className="leads-table-wrap">
                                <table style={S.table}>
                                    <thead>
                                        <tr>
                                            {[
                                                ...(canExportCsv ? [{ label: "Select", w: "4%" }] : []),
                                                { label: "#", w: "4%" },
                                                { label: "Business", w: "14%" },
                                                { label: "Rating", w: "7%" },
                                                { label: "Reviews", w: "7%" },
                                                { label: "Category", w: "12%" },
                                                { label: "Address", w: "15%" },
                                                { label: "Phone", w: "9%" },
                                                { label: "Email", w: "13%" },
                                                { label: "Website", w: "15%" },
                                            ].map((col) => (
                                                <th key={col.label} style={{ ...S.th, width: col.w }}>
                                                    {col.label === "Select" ? (
                                                        <input
                                                            type="checkbox"
                                                            className="lead-checkbox"
                                                            checked={allVisibleSelected}
                                                            onChange={toggleVisibleSelection}
                                                            title={allVisibleSelected ? "Unselect visible leads" : "Select visible leads"}
                                                        />
                                                    ) : col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.map((lead, index) => {
                                            const leadId = getLeadId(lead);

                                            return (
                                                <tr key={leadId} className="lead-row" style={{ background: index % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                                                    {canExportCsv && (
                                                        <td style={S.td}>
                                                            <input
                                                                type="checkbox"
                                                                className="lead-checkbox"
                                                                checked={selectedSet.has(leadId)}
                                                                onChange={() => toggleLeadSelection(leadId)}
                                                                title="Select lead"
                                                            />
                                                        </td>
                                                    )}
                                                    <td style={{ ...S.td, ...S.tdMono, color: "#94a3b8", fontSize: "12px" }}>
                                                        {(pagination.page - 1) * 50 + leads.findIndex((item) => getLeadId(item) === leadId) + 1}
                                                    </td>
                                                    <td style={{ ...S.td, fontWeight: "600", color: "#0f172a", fontSize: "13px" }}>
                                                        {lead.name || <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={S.td}>
                                                        {lead.rating ? (
                                                            <span className="rating-badge">
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                                </svg>
                                                                <span style={{ color: "#0f172a" }}>{lead.rating}</span>
                                                            </span>
                                                        ) : <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={{ ...S.td, color: "#475569", fontSize: "12.5px" }}>
                                                        {lead.reviews ? lead.reviews.toLocaleString() : <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={S.td}>
                                                        {lead.category
                                                            ? <span className="category-tag" title={lead.category}>{lead.category}</span>
                                                            : <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={{ ...S.td, color: "#64748b", fontSize: "12px", lineHeight: "1.5" }}>
                                                        {lead.address || <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={{ ...S.td, ...S.tdMono, color: "#334155", fontSize: "11.5px" }}>
                                                        {lead.phone || <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={{ ...S.td, color: "#334155", fontSize: "11.5px" }}>
                                                        {lead.email
                                                            ? <a href={`mailto:${lead.email}`} style={S.emailLink}>{lead.email}</a>
                                                            : <span style={S.dash}>—</span>}
                                                    </td>
                                                    <td style={S.td}>
                                                        {lead.website ? (
                                                            <a
                                                                href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="website-link"
                                                                title={lead.website}
                                                            >
                                                                {lead.website}
                                                            </a>
                                                        ) : <span style={S.dash}>—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div style={S.pagination}>
                                <span style={S.pageInfo}>
                                    <strong style={{ color: "#0f172a" }}>{startEntry}–{totalShowing}</strong>
                                    <span style={{ color: "#94a3b8" }}> of {pagination.total.toLocaleString()} leads</span>
                                </span>

                                <div style={S.pageControls}>
                                    <button
                                        className="page-btn"
                                        style={S.pageBtn}
                                        disabled={pagination.page === 1}
                                        onClick={() => loadLeads(pagination.page - 1)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="15 18 9 12 15 6" />
                                        </svg>
                                        Prev
                                    </button>

                                    <div style={S.pageIndicator}>
                                        <span style={{ fontWeight: "700", color: "#ff6b35" }}>{pagination.page}</span>
                                        <span style={{ color: "#cbd5e1", margin: "0 2px" }}>/</span>
                                        <span style={{ color: "#94a3b8" }}>{pagination.totalPages}</span>
                                    </div>

                                    <button
                                        className="page-btn"
                                        style={S.pageBtn}
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => loadLeads(pagination.page + 1)}
                                    >
                                        Next
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

const S = {
    wrapper: {
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
    },

    header: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "24px",
    },

    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "6px",
    },

    titleIcon: {
        width: "36px",
        height: "36px",
        borderRadius: "10px",
        background: "rgba(255,107,53,0.08)",
        border: "1px solid rgba(255,107,53,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    title: {
        fontSize: "28px",
        fontWeight: "800",
        margin: 0,
        color: "#0f172a",
        letterSpacing: "-0.5px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    sub: {
        color: "#64748b",
        margin: 0,
        fontSize: "13.5px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    statsRow: {
        display: "flex",
        gap: "10px",
        alignItems: "center",
    },

    statPill: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "8px 16px",
        minWidth: "72px",
    },

    statNum: {
        fontSize: "17px",
        fontWeight: "800",
        color: "#0f172a",
        lineHeight: 1.2,
    },

    statLabel: {
        fontSize: "10px",
        fontWeight: "600",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
        marginTop: "1px",
    },

    card: {
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)",
        width: "100%",
        maxWidth: "100%",
    },

    filterPanel: {
        padding: "14px 16px",
        borderBottom: "1px solid #f1f5f9",
        background: "#ffffff",
    },

    filterGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: "10px",
        marginBottom: "10px",
    },

    filterInput: {
        width: "100%",
        minWidth: 0,
        padding: "9px 11px",
        border: "1px solid #e2e8f0",
        borderRadius: "9px",
        outline: "none",
        color: "#0f172a",
        background: "#fff",
        fontSize: "12px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    dateRangeWrap: {
        position: "relative",
        minWidth: 0,
    },

    dateRangeBtn: {
        width: "100%",
        minWidth: 0,
        padding: "9px 11px",
        border: "1px solid #e2e8f0",
        borderRadius: "9px",
        background: "#fff",
        color: "#0f172a",
        fontSize: "12px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    dateChevron: {
        color: "#94a3b8",
        flexShrink: 0,
    },

    calendarPanel: {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "292px",
        padding: "12px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
        zIndex: 30,
    },

    calendarHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "10px",
    },

    calendarNavBtn: {
        width: "30px",
        height: "30px",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        background: "#fff",
        color: "#475569",
        fontSize: "18px",
        lineHeight: 1,
        cursor: "pointer",
    },

    calendarTitle: {
        color: "#0f172a",
        fontSize: "13px",
        fontWeight: "800",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    weekdayGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "4px",
        marginBottom: "5px",
    },

    weekday: {
        textAlign: "center",
        color: "#94a3b8",
        fontSize: "10px",
        fontWeight: "800",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    dayGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "4px",
    },

    dayBtn: {
        height: "32px",
        border: "1px solid transparent",
        borderRadius: "8px",
        background: "#ffffff",
        color: "#334155",
        fontSize: "12px",
        fontWeight: "700",
        cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    dayBtnMuted: {
        color: "#cbd5e1",
    },

    dayBtnRange: {
        background: "rgba(255,107,53,0.08)",
        color: "#ff6b35",
    },

    dayBtnSelected: {
        background: "#ff6b35",
        color: "#ffffff",
        borderColor: "#ff6b35",
    },

    calendarFooter: {
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        marginTop: "12px",
    },

    applyDateBtn: {
        padding: "8px 12px",
        border: "none",
        borderRadius: "9px",
        background: "linear-gradient(135deg, #ff6b35, #ff4500)",
        color: "#ffffff",
        fontSize: "12px",
        fontWeight: "800",
        cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    filterActions: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
    },

    checkLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color: "#475569",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    lightBtn: {
        padding: "8px 12px",
        border: "1px solid #e2e8f0",
        borderRadius: "9px",
        background: "#fff",
        color: "#475569",
        fontSize: "12px",
        fontWeight: "700",
        cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    exportBtn: {
        marginLeft: "auto",
        padding: "8px 13px",
        border: "none",
        borderRadius: "9px",
        background: "linear-gradient(135deg, #ff6b35, #ff4500)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: "800",
        cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    filterMeta: {
        color: "#94a3b8",
        fontSize: "11.5px",
        marginTop: "9px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    table: {
        width: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        fontSize: "12px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    th: {
        textAlign: "left",
        padding: "10px 8px",
        background: "#f8fafc",
        color: "#94a3b8",
        borderBottom: "1px solid #e2e8f0",
        textTransform: "uppercase",
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "0.8px",
        whiteSpace: "nowrap",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    td: {
        padding: "10px 8px",
        borderBottom: "1px solid #f1f5f9",
        color: "#334155",
        verticalAlign: "middle",
        wordBreak: "break-word",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    tdMono: {
        fontVariantNumeric: "tabular-nums",
    },

    dash: {
        color: "#cbd5e1",
        fontWeight: "400",
    },

    emailLink: {
        color: "#475569",
        textDecoration: "none",
        fontSize: "11.5px",
        display: "inline",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
    },

    pagination: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 20px",
        borderTop: "1px solid #f1f5f9",
        background: "#fafbfc",
        flexWrap: "wrap",
        gap: "12px",
    },

    pageInfo: {
        fontSize: "13px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    pageControls: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },

    pageBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "8px 14px",
        border: "1px solid #e2e8f0",
        background: "#fff",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "13px",
        color: "#475569",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        transition: "all 0.15s ease",
    },

    pageIndicator: {
        fontSize: "13.5px",
        fontWeight: "700",
        padding: "8px 14px",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        gap: "2px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
        gap: "10px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
    },

    emptyIcon: {
        width: "56px",
        height: "56px",
        borderRadius: "16px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "4px",
    },
};
