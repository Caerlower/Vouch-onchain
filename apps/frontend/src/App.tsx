import { Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Demo from "./pages/Demo";
import Register from "./pages/Register";
import Claim from "./pages/Claim";
import HowItWorks from "./pages/HowItWorks";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Landing />} />
        <Route path="demo" element={<Demo />} />
        <Route path="register" element={<Register />} />
        <Route path="claim/:code" element={<Claim />} />
        <Route path="how" element={<HowItWorks />} />
      </Route>
    </Routes>
  );
}
