import { normalizeItems } from "../crudHelpers.js";
import { normalizeLookbook } from "../response.js";

describe("lookbook item brand", () => {
    test("persists optional brand in normalized payload items", () => {
        expect(
            normalizeItems([
                {
                    name: "Coat",
                    brand: "Bazhane",
                    link: "https://example.com/coat",
                },
            ])
        ).toEqual([
            {
                name: "Coat",
                brand: "Bazhane",
                link: "https://example.com/coat",
            },
        ]);
    });

    test("exposes optional brand in response dto items", () => {
        const result = normalizeLookbook({
            id: "lookbook-1",
            items: [
                {
                    name: "Coat",
                    brand: "Bazhane",
                    link: "https://example.com/coat",
                },
            ],
        });

        expect(result.items).toEqual([
            {
                name: "Coat",
                brand: "Bazhane",
                link: "https://example.com/coat",
            },
        ]);
    });
});
