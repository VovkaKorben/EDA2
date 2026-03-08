Attribute VB_Name = "Module1"
' VBA Script for CorelDRAW
' Автор: Аня
Sub Phys()
    Dim s As Shape
    Dim magObjects As New Collection
    Dim originX As Double, originY As Double
    Dim startObj As Shape
    Dim unitFactor As Double
    Dim separator As String
    Dim textBlock As String, pinBlock As String, nodeBlock As String
    Dim pinCounter As Long
    
    separator = String(80, "-")
    ActiveDocument.Unit = cdrMillimeter
    unitFactor = 25.4 / 20 ' 1/20 дюйма
    pinCounter = 0
    
    If ActiveSelection.Shapes.Count = 0 Then
        Debug.Print "Ошибка: Ничего не выделено."
        Exit Sub
    End If
    
    FindMagentaObjects ActiveSelection.Shapes, magObjects
    
    If magObjects.Count = 0 Then
        Debug.Print "Объекты с заливкой CMYK(0,100,0,0) не найдены."
        Exit Sub
    End If
    
    Set startObj = magObjects(1)
    For Each s In magObjects
        If s.CenterY > startObj.CenterY Then
            Set startObj = s
        ElseIf s.CenterY = startObj.CenterY And s.CenterX < startObj.CenterX Then
            Set startObj = s
        End If
    Next s
    
    originX = startObj.CenterX
    originY = startObj.CenterY
    
    CollectDataRecursive ActiveSelection.Shapes, originX, originY, unitFactor, textBlock, pinBlock, nodeBlock, pinCounter
    
    ' Вывод отчета
    Debug.Print separator
    
    ' Блок Текста
    If textBlock <> "" Then
        Debug.Print "Text:"
        Debug.Print CleanTail(textBlock, vbCrLf)
    End If
    Debug.Print separator
    
    ' Блок Пинов
    If pinBlock <> "" Then
        Debug.Print CleanTail(pinBlock, "; ")
    End If
    Debug.Print separator
    
    ' Блок Контуров
    If nodeBlock <> "" Then
        Dim resNodes As String
        resNodes = CleanTail(nodeBlock, vbCrLf)
        resNodes = CleanTail(resNodes, ",")
        Debug.Print resNodes
    End If
    Debug.Print separator
End Sub

' Функция точной очистки хвоста строки
Private Function CleanTail(ByVal str As String, ByVal tail As String) As String
    If Right(str, Len(tail)) = tail Then
        CleanTail = Left(str, Len(str) - Len(tail))
    Else
        CleanTail = str
    End If
End Function

' Рекурсивный сбор данных
Private Sub CollectDataRecursive(shs As Shapes, oX As Double, oY As Double, factor As Double, ByRef txtB As String, ByRef pinB As String, ByRef nodB As String, ByRef pCount As Long)
    Dim s As Shape
    Dim relX As Double, relY As Double
    Dim idStr As String
    Dim n As Node, nodeStr As String
    
    For Each s In shs
        If s.Type = cdrGroupShape Then
            CollectDataRecursive s.Shapes, oX, oY, factor, txtB, pinB, nodB, pCount
        Else
            relX = s.CenterX - oX
            relY = s.CenterY - oY
            
            ' Текст (Outline Cyan)
            If IsCMYKColor(s.Outline.Color, 100, 0, 0, 0) Then
                txtB = txtB & Round(relX, 4) & ", " & Round(relY, 4) & vbCrLf
            
            ' Пины (Fill Magenta)
            ElseIf IsCMYKColor(s.Fill.UniformColor, 0, 100, 0, 0) Then
                pCount = pCount + 1
                If s.Name <> "" Then idStr = s.Name Else idStr = "PIN" & pCount
                CheckGrid relX, relY, factor, idStr
                pinB = pinB & idStr & ": " & Round(relX, 4) & ", " & Round(relY, 4) & "; "
            
            ' Узлы (Outline Black)
            ElseIf IsCMYKColor(s.Outline.Color, 0, 0, 0, 100) Then
                If s.Type = cdrCurveShape Then
                    nodeStr = "("
                    For Each n In s.Curve.Nodes
                        nodeStr = nodeStr & Round(n.PositionX - oX, 4) & "," & Round(n.PositionY - oY, 4) & ","
                    Next n
                    If Right(nodeStr, 1) = "," Then nodeStr = Left(nodeStr, Len(nodeStr) - 1)
                    nodB = nodB & nodeStr & ")," & vbCrLf
                End If
            End If
        End If
    Next s
End Sub

Private Sub FindMagentaObjects(shs As Shapes, ByRef coll As Collection)
    Dim s As Shape
    For Each s In shs
        If s.Type = cdrGroupShape Then
            FindMagentaObjects s.Shapes, coll
        Else
            If IsCMYKColor(s.Fill.UniformColor, 0, 100, 0, 0) Then coll.Add s
        End If
    Next s
End Sub

Private Function IsCMYKColor(c As Color, cy As Long, ma As Long, ye As Long, bl As Long) As Boolean
    If c.Type <> cdrColorCMYK Then IsCMYKColor = False: Exit Function
    IsCMYKColor = (c.CMYKCyan = cy And c.CMYKMagenta = ma And c.CMYKYellow = ye And c.CMYKBlack = bl)
End Function

Private Sub CheckGrid(x As Double, y As Double, f As Double, id As String)
    Dim errX As Double, errY As Double
    errX = Abs(x / f - Round(x / f))
    errY = Abs(y / f - Round(y / f))
    If errX > 0.001 Or errY > 0.001 Then
        Debug.Print "!!! ВНИМАНИЕ: Объект " & id & " вне сетки 1/20 !!!"
    End If
End Sub
