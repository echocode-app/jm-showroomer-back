import { normalizeItems } from "../crudHelpers.js";
import { normalizeLookbook } from "../response.js";

const PUBLIC_INSTAGRAM_URL = "https://www.instagram.com/dim_brendiv/";

describe("lookbook item brand", () => {
    test("persists optional brand in normalized payload items", () => {
        expect(
            normalizeItems([
                {
                    name: "Coat",
                    nameKey: "coat",
                    brand: "Bazhane",
                    link: PUBLIC_INSTAGRAM_URL,
                },
            ])
        ).toEqual([
            {
                name: "Coat",
                nameKey: "coat",
                brand: "Bazhane",
                link: PUBLIC_INSTAGRAM_URL,
            },
        ]);
    });

    test("exposes optional brand in response dto items", () => {
        const result = normalizeLookbook({
            id: "lookbook-1",
            items: [
                {
                    name: "Coat",
                    nameKey: "coat",
                    brand: "Bazhane",
                    link: PUBLIC_INSTAGRAM_URL,
                },
            ],
        });

        expect(result.items).toEqual([
            {
                name: "Coat",
                nameKey: "coat",
                brand: "Bazhane",
                link: PUBLIC_INSTAGRAM_URL,
            },
        ]);
    });

    test("infers nameKey from legacy item names", () => {
        const result = normalizeLookbook({
            id: "lookbook-legacy",
            items: [
                {
                    name: "Evening Dress",
                    link: PUBLIC_INSTAGRAM_URL,
                },
            ],
        });

        expect(result.items).toEqual([
            {
                name: "Evening Dress",
                nameKey: "evening_dress",
                brand: null,
                link: PUBLIC_INSTAGRAM_URL,
            },
        ]);
    });
});
