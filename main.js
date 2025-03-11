d3.csv("CGMacros_merge.csv").then(function (data) {
  // Convert data types
  data.forEach((d) => {
    d.Timestamp = new Date(d.Timestamp);
    d["Libre GL"] = +d["Libre GL"];
    d["Dexcom GL"] = +d["Dexcom GL"];
    d["Meal Type"] = d["Meal Type"];
    d["Calories"] = +d["Calories"];
    d["Carbs"] = +d["Carbs"];
    d["Protein"] = +d["Protein"];
    d["Fat"] = +d["Fat"];
    d["Fiber"] = +d["Fiber"];
    d["Amount Consumed"] = +d["Amount Consumed"];
  });

  // Get unique participants for dropdown
  let participants = [...new Set(data.map((d) => d.Participant_ID))];

  // Populate dropdown
  let dropdown = d3.select("#participantDropdown");
  dropdown
    .selectAll("option")
    .data(participants)
    .enter()
    .append("option")
    .text((d) => d);

  // Set up chart dimensions
  const svg = d3.select("#glucoseChart"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    margin = { top: 20, right: 50, bottom: 50, left: 70 };

  const xScale = d3.scaleTime().range([margin.left, width - margin.right]);
  const yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`);
  const yAxis = svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`);

  const line = d3
    .line()
    .x((d) => xScale(d.Timestamp))
    .y((d) => yScale(d["Libre GL"]));

  const tooltip = d3.select(".tooltip");

  // Add a clipping path to the SVG
  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "chart-clip")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom);

  // Apply the clipping path to the chart content
  const chartContent = svg.append("g").attr("clip-path", "url(#chart-clip)");

  // Track zoom state
  let isZoomed = false;
  let originalData = []; // Store the original filtered data

  // Function to update chart based on selected participant
  // Function to update chart based on selected participant
  function updateChart(participant) {
    let filteredData = data.filter((d) => d.Participant_ID === participant);
    originalData = filteredData; // Store the original data

    // Update scales
    xScale.domain(d3.extent(filteredData, (d) => d.Timestamp));
    yScale.domain([
      d3.min(filteredData, (d) => d["Libre GL"]) - 10,
      d3.max(filteredData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes
    xAxis.call(d3.axisBottom(xScale).ticks(10));
    yAxis.call(d3.axisLeft(yScale));

    // Clear existing paths and dots
    chartContent.selectAll(".line-segment").remove();
    chartContent.selectAll(".dot").remove();

    const mealIndices = filteredData
      .map((d, i) =>
        d["Meal Type"] && d["Meal Type"].trim() !== "" ? i : null
      )
      .filter((i) => i !== null);

    // Create path segments between meal points
    for (let i = 0; i < mealIndices.length - 1; i++) {
      const startIndex = mealIndices[i];
      const endIndex = mealIndices[i + 1];
      const segmentData = filteredData.slice(startIndex, endIndex + 1);

      // Draw path segment
      chartContent
        .append("path")
        .datum(segmentData)
        .attr("class", "line-segment")
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line)
        .on("mouseover", function () {
          d3.select(this).attr("stroke-width", 4); // Enlarge path segment on hover
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke-width", 2); // Reset path segment width on mouseout
        })
        .on("click", (event, d) => {
          event.stopPropagation(); // Stop event propagation
          if (!isZoomed) {
            // Zoom in to the clicked segment
            isZoomed = true;
            xScale.domain(d3.extent(segmentData, (d) => d.Timestamp));
            yScale.domain([
              d3.min(segmentData, (d) => d["Libre GL"]) - 10,
              d3.max(segmentData, (d) => d["Libre GL"]) + 10,
            ]);

            // Update axes and redraw the line segment
            xAxis.call(d3.axisBottom(xScale));
            yAxis.call(d3.axisLeft(yScale));
            chartContent.selectAll(".line-segment").attr("d", line);

            // Remove all dots
            chartContent.selectAll(".dot").remove();
          }
        });
    }

    // Add meal points for the current participant
    const mealData = filteredData.filter(
      (d) => d["Meal Type"] && d["Meal Type"].trim() !== ""
    );

    // Bind data to dots
    const dots = chartContent.selectAll(".dot").data(mealData);

    // Enter + update dots
    dots
      .enter()
      .append("circle")
      .attr("class", "dot")
      .merge(dots)
      .attr("cx", (d) => xScale(d.Timestamp))
      .attr("cy", (d) => yScale(d["Libre GL"]))
      .attr("r", 5)
      .on("mouseover", (event, d) => {
        // Calculate tooltip position relative to the dot
        const xPos = xScale(d.Timestamp); // X position of the dot
        const yPos = yScale(d["Libre GL"]); // Y position of the dot

        tooltip
          .style("display", "block")
          .style("left", `${xPos + 10}px`)
          .style("top", `${yPos - 28}px`).html(`
            <strong>${d["Meal Type"]}</strong><br>
            Calories: ${d.Calories}<br>
            Carbs: ${d.Carbs}<br>
            Protein: ${d.Protein}<br>
            Fat: ${d.Fat}<br>
            Fiber: ${d.Fiber}<br>
            Amount Consumed: ${d["Amount Consumed"]}
        `);
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      })
      .raise(); // Bring dots to the front

    // Remove unused dots
    dots.exit().remove();

    // Add click listener to reset zoom
    svg.on("click", (event) => {
      if (isZoomed) {
        // Reset zoom
        isZoomed = false;
        xScale.domain(d3.extent(originalData, (d) => d.Timestamp));
        yScale.domain([
          d3.min(originalData, (d) => d["Libre GL"]) - 10,
          d3.max(originalData, (d) => d["Libre GL"]) + 10,
        ]);

        // Update axes and redraw the chart
        xAxis.call(d3.axisBottom(xScale).ticks(10));
        yAxis.call(d3.axisLeft(yScale));
        chartContent.selectAll(".line-segment").attr("d", line);

        // Re-add dots
        const mealData = originalData.filter(
          (d) => d["Meal Type"] && d["Meal Type"].trim() !== ""
        );
        const dots = chartContent.selectAll(".dot").data(mealData);

        dots
          .enter()
          .append("circle")
          .attr("class", "dot")
          .merge(dots)
          .attr("cx", (d) => xScale(d.Timestamp))
          .attr("cy", (d) => yScale(d["Libre GL"]))
          .attr("r", 5)
          .on("mouseover", (event, d) => {
            // Calculate tooltip position relative to the dot
            const xPos = xScale(d.Timestamp); // X position of the dot
            const yPos = yScale(d["Libre GL"]); // Y position of the dot

            tooltip
              .style("display", "block")
              .style("left", `${xPos + 10}px`)
              .style("top", `${yPos - 28}px`).html(`
                <strong>${d["Meal Type"]}</strong><br>
                Calories: ${d.Calories}<br>
                Carbs: ${d.Carbs}<br>
                Protein: ${d.Protein}<br>
                Fat: ${d.Fat}<br>
                Fiber: ${d.Fiber}<br>
                Amount Consumed: ${d["Amount Consumed"]}
            `);
          })
          .on("mouseout", () => {
            tooltip.style("display", "none");
          })
          .raise(); // Bring dots to the front

        dots.exit().remove();
      }
    });
  }

  // Initialize with the first participant
  updateChart(participants[0]);

  // Update chart when dropdown changes
  dropdown.on("change", function () {
    updateChart(this.value);
  });
});
