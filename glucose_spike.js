export function createGlucoseSpike() {
    // Set chart dimensions
    const width = 600, height = 400, margin = { top: 50, right: 150, bottom: 50, left: 70 };

    // Create SVG canvas
    const svg = d3.select("#glucoseChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .attr('class', 'spike-chart');

    // Fixed Y-axis scale
    const yScale = d3.scaleLinear()
        .domain([70, 900])  // Fixed glucose range
        .range([height, 0]);

    // X-axis scale
    const xScale = d3.scalePoint()
        .domain(["Pre-Meal", "1-Hour", "2-Hour"])
        .range([0, width]);

    // Add X and Y axes with formatted labels
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => `${d} mg/dL`));

    // Add Grid Lines
    const grid = svg.append("g").attr("class", "grid");

    // Horizontal Grid Lines (Y-axis)
    grid.selectAll(".yGrid")
        .data(yScale.ticks())
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    // Line generator
    const line = d3.line()
        .x((d, i) => xScale(["Pre-Meal", "1-Hour", "2-Hour"][i]))
        .y(d => yScale(d));

    // Colors for different risk groups
    const colors = { "Healthy": "green", "Prediabetic": "orange", "Diabetic": "red" };

    // Store line references
    let lines = {};
    let activeLines = { "Healthy": true, "Prediabetic": true, "Diabetic": true };

    // Initialize lines for each group
    ["Healthy", "Prediabetic", "Diabetic"].forEach(group => {
        lines[group] = svg.append("path")
            .datum([90, 90, 90]) // Default glucose values
            .attr("fill", "none")
            .attr("stroke", colors[group])
            .attr("stroke-width", 3)
            .attr("opacity", 1) // Fully visible initially
            .attr("d", line);
    });

    // **Create Interactive Legend with Animation**
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 1000}, 50)`)
        .attr("transform", `translate(${height - 390}, 50)`);

    Object.keys(colors).forEach((group, i) => {
        let legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`)
            .style("cursor", "pointer")
            .on("click", function () {
                // Toggle visibility with fade animation
                activeLines[group] = !activeLines[group];
                lines[group]
                    .transition()
                    .duration(500)
                    .style("opacity", activeLines[group] ? 1 : 0); // Fade in/out

                // Update legend opacity
                d3.select(this).select("text")
                    .transition()
                    .duration(500)
                    .style("opacity", activeLines[group] ? 1 : 0.3);
            });

        // Legend color box
        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colors[group]);

        // Legend text
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(group)
            .style("font-size", "14px");
    });

    // Function to calculate glucose spike
    function calculateGlucoseSpike(riskLevel, preMealGlucose, bmi, carbs, protein, fat) {
        const coeffs_1H = {
            "Healthy": { BMI: 0.2, Carbs: 0.08, Protein: -0.03, Fat: 0.01, PreMealGlucose: 0.95 },
            "Prediabetic": { BMI: 0.5, Carbs: 0.12, Protein: -0.02, Fat: 0.05, PreMealGlucose: 1.1 },
            "Diabetic": { BMI: 1.0, Carbs: 0.18, Protein: 0.01, Fat: 0.12, PreMealGlucose: 1.2 }
        };

        const coeffs_2H = {
            "Healthy": { BMI: 0.1, Carbs: 0.05, Protein: -0.02, Fat: 0.01, PreviousGlucose: 0.5 },
            "Prediabetic": { BMI: 0.3, Carbs: 0.08, Protein: -0.03, Fat: 0.03, PreviousGlucose: 0.7 },
            "Diabetic": { BMI: 0.6, Carbs: 0.12, Protein: 0.02, Fat: 0.1, PreviousGlucose: 1.0 }
        };

        let group = riskLevel === 0 ? "Healthy" : riskLevel === 1 ? "Prediabetic" : "Diabetic";

        let glucose1H = preMealGlucose +
                        (bmi * coeffs_1H[group].BMI) +
                        (carbs * coeffs_1H[group].Carbs) +
                        (protein * coeffs_1H[group].Protein) +
                        (fat * coeffs_1H[group].Fat) +
                        (preMealGlucose * coeffs_1H[group].PreMealGlucose);

        let glucose2H = glucose1H +
                        (bmi * coeffs_2H[group].BMI) +
                        (carbs * coeffs_2H[group].Carbs) +
                        (protein * coeffs_2H[group].Protein) +
                        (fat * coeffs_2H[group].Fat) +
                        (glucose1H * coeffs_2H[group].PreviousGlucose);

        return { glucose1H, glucose2H };
    }

    // Function to update predictions and redraw the lines
    function updatePrediction(preMealGlucose, bmi, carbs, protein, fat) {
        let data = {
            "Healthy": calculateGlucoseSpike(0, preMealGlucose, bmi, carbs, protein, fat),
            "Prediabetic": calculateGlucoseSpike(1, preMealGlucose, bmi, carbs, protein, fat),
            "Diabetic": calculateGlucoseSpike(2, preMealGlucose, bmi, carbs, protein, fat)
        };

        // Update each line based on new calculations
        ["Healthy", "Prediabetic", "Diabetic"].forEach(group => {
            let glucoseValues = [preMealGlucose, data[group].glucose1H, data[group].glucose2H];

            lines[group]
                .datum(glucoseValues)
                .transition().duration(500)
                .attr("d", line);
        });
    }

    // Function to update slider values in UI
    function updateDisplayedValues() {
        document.getElementById("preMealGlucoseValue").innerText = document.getElementById("preMealGlucose").value;
        document.getElementById("bmiValue").innerText = document.getElementById("bmi").value;
        document.getElementById("carbsValue").innerText = document.getElementById("carbs-spike").value;
        document.getElementById("proteinValue").innerText = document.getElementById("protein-spike").value;
        document.getElementById("fatValue").innerText = document.getElementById("fat-spike").value;
    }

    // Function to update values from sliders
    function updateValues() {
        updateDisplayedValues(); // Ensure UI updates
        updatePrediction(
            parseFloat(document.getElementById("preMealGlucose").value),
            parseFloat(document.getElementById("bmi").value),
            parseFloat(document.getElementById("carbs-spike").value),
            parseFloat(document.getElementById("protein-spike").value),
            parseFloat(document.getElementById("fat-spike").value)
        );
    }

    // Event Listeners for Sliders
    document.querySelectorAll("input").forEach(input => input.addEventListener("input", updateValues));

    // Initialize with default values
    updateValues();
};
