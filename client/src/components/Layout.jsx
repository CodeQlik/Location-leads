import Sidebar from "./Sidebar";

export default function Layout({
    children,
    activePage,
    setActivePage,
    authUser,
    handleLogout,
}) {
    const mainOffset = 265;

    return (
        <div style={S.page}>
            <Sidebar
                activePage={activePage}
                setActivePage={setActivePage}
                authUser={authUser}
                handleLogout={handleLogout}
            />

            <main
                style={{
                    ...S.main,
                    marginLeft: `${mainOffset}px`,
                    width: `calc(100% - ${mainOffset}px)`,
                }}
            >
                {children}
            </main>
        </div>
    );
}

const S = {
    page: {
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
    },

    main: {
        minHeight: "100vh",
        padding: "28px 20px",
        transition: "all 0.25s ease",
        overflowX: "hidden",
        boxSizing: "border-box",
        maxWidth: "100%",
    },
};
