import { createContext, useContext } from "react";
import { api } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";

const OptionsContext = createContext({ options: null, loading: true, error: null });
export const useOptions = () => useContext(OptionsContext);

/** Loads dropdown options (platforms, ads, age groups...) once after login. */
export function OptionsProvider({ children }) {
  const { data, loading, error } = useApi(() => api.get("/meta/options"), []);
  return <OptionsContext.Provider value={{ options: data, loading, error }}>{children}</OptionsContext.Provider>;
}
