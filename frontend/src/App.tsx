import React, { useState } from "react";
import { useQuery } from "@apollo/client/react";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import Board from "./components/Board";
import { ME } from "./gql";
import { client } from "./apollo";
import "./App.css";

export default function App() {
  const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [activeBoardIsOwner, setActiveBoardIsOwner] = useState(true);
  const [activeBoardViewerRole, setActiveBoardViewerRole] = useState<"VIEWER" | "EDITOR" | null>(null);

  const { data: meData } = useQuery(ME, { skip: !token });
  const userId = (meData as any)?.me?.id;
  const userName = (meData as any)?.me?.name;

  const handleLogin = (t: string) => {
    sessionStorage.setItem("token", t);
    setToken(t);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setToken(null);
    setActiveBoardId(null);
    client.clearStore();
  };

  const handleSelectBoard = (id: string, isOwner: boolean, myRole: "VIEWER" | "EDITOR" | null) => {
    setActiveBoardId(id);
    setActiveBoardIsOwner(isOwner);
    setActiveBoardViewerRole(myRole);
  };

  if (!token) return <Auth onLogin={handleLogin} />;
  if (activeBoardId) return (
    <Board
      boardId={activeBoardId}
      onBack={() => setActiveBoardId(null)}
      onLogout={handleLogout}
      userName={userName}
      isOwner={activeBoardIsOwner}
      viewerRole={activeBoardViewerRole}
    />
  );
  return (
    <Dashboard
      userId={userId}
      onSelectBoard={handleSelectBoard}
      onLogout={handleLogout}
      userName={userName}
    />
  );
}
