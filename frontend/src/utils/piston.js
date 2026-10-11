// frontend/src/utils/piston.js

const LANGUAGE_VERSIONS = {
    javascript: "18.15.0",
    python: "3.10.0",
    cpp: "10.2.0",
    java: "15.0.2",
};

export const executeCode = async (language, sourceCode) => {
    const version = LANGUAGE_VERSIONS[language] || "*";

    try {
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                language: language === "cpp" ? "cpp" : language,
                version: version,
                files: [
                    {
                        content: sourceCode,
                    },
                ],
            }),
        });

        const data = await response.json();

        if (data.run) {
            // If there's a compilation error or runtime error, return it or standard output
            if (data.run.stderr) {
                return data.run.stderr;
            }
            return data.run.output;
        } else if (data.message) {
            return `Error: ${data.message}`;
        }

        return "Execution failed: No output returned from server.";
    } catch (error) {
        return `Network or Execution Error: ${error.message}`;
    }
};