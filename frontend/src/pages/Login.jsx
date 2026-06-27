import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { setRole } = useAuth();
  const navigate = useNavigate();

  const handleRole = (role) => {
    setRole(role); // store the chosen role in Context
    if (role === "manager") {
      navigate("/manager");
    } else {
      navigate("/rla"); // RLA goes to the cardholder picker
    }
  };

  return (
    <div>
      <h1>MBZUAI RLA Prepaid Card Reconciliation</h1>
      <p>Select your role to continue</p>
      <button onClick={() => handleRole("rla")}>RLA / Cardholder</button>
      <button onClick={() => handleRole("manager")}>Manager</button>
    </div>
  );
}
