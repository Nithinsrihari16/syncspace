const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export async function executeCode(language, code) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ language, code }),
        });

        if (!response.ok) {
            throw new Error(`Execution failed with status ${response.status}`);
        }

        const data = await response.json();
        return data; // Expected format: { run: { output: "...", stdout: "...", stderr: "" } }
    } catch (error) {
        console.error("Piston execution error via backend:", error);
        return {
            run: {
                output: "",
                stderr: `Error connecting to backend execution server: ${error.message}`,
            },
        };
    }
}