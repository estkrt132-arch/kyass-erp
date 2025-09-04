export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { content } = req.body;

  const owner = "estkrt132-arch";
  const repo = "kyass-erp";
  const path = "data.json";

  try {
    const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
    });
    const fileData = await fileRes.json();

    const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "update data.json",
        content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
        sha: fileData.sha,
      }),
    });

    const updateData = await updateRes.json();
    res.status(200).json(updateData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating file" });
  }
}
