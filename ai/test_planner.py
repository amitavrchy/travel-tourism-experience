import os
import unittest
os.environ["CHROMA_DISABLED"] = "1"
os.environ.pop("OPENAI_API_KEY", None)
from fastapi.testclient import TestClient
from app.main import app, embedding

class PlannerTests(unittest.TestCase):
    def test_context_grounding_and_schema(self):
        with TestClient(app) as client:
            health = client.get("/health").json()
            self.assertGreater(health["indexedDocuments"], 0)
            result = client.post("/plan", json={"destinationSlug":"bali", "days":5, "travelers":2, "budget":150, "pace":"RELAXED"})
            self.assertEqual(result.status_code, 200)
            plan = result.json()
            self.assertEqual(len(plan["days"]), 5)
            self.assertEqual(plan["mode"], "curated")
            sources = {source["id"] for source in plan["sources"]}
            for day in plan["days"]:
                self.assertEqual(len([item for item in day["items"] if item["type"] == "poi"]), 1)
                for item in day["items"]:
                    self.assertIn(item["sourceId"], sources)
            refined = client.post("/refine", json={"plan":plan,"input":{"destinationSlug":"bali","days":5},"instruction":"make it slower"})
            self.assertEqual(refined.status_code, 200)
            self.assertEqual(client.post("/plan", json={"days":100}).status_code, 422)
            self.assertEqual(client.post("/plan", json={"destinationSlug":"unknown"}).status_code, 404)

    def test_embeddings_are_stable_and_normalized(self):
        vector = embedding("Bali local food and culture")
        self.assertEqual(vector, embedding("Bali local food and culture"))
        self.assertAlmostEqual(sum(x*x for x in vector), 1)

if __name__ == "__main__":
    unittest.main()
